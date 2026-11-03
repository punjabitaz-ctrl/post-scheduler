import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import z from "zod";
import * as s from "./db";
import { initDb } from "./db";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const FILE_CHUNK_SIZE_BYTES = 2000000;

function detectFileContentType(buffer: Uint8Array): s.FileContentType {
  if (isJpeg(buffer)) return "image/jpeg";

  if (isPng(buffer)) return "image/png";

  if (isMp4(buffer)) return "video/mp4";

  throw new HTTPException(400, {
    message: "File content must be JPEG, PNG, or MP4",
  });
}

function isJpeg(buffer: Uint8Array) {
  return (
    buffer.byteLength >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

function isPng(buffer: Uint8Array) {
  return (
    buffer.byteLength >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function isMp4(buffer: Uint8Array) {
  return (
    buffer.byteLength >= 12 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  );
}

function chunkBuffer(buffer: Uint8Array, chunkSize: number) {
  const chunks: Uint8Array[] = [];

  for (let offset = 0; offset < buffer.byteLength; offset += chunkSize) {
    chunks.push(buffer.slice(offset, offset + chunkSize));
  }

  return chunks;
}

function assembleChunks(chunks: Uint8Array[]) {
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const buffer = new Uint8Array(totalSize);
  let offset = 0;

  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return buffer;
}

async function sha256Hex(buffer: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type StoredFileMetadata = {
  id: string;
  userId: string;
  sha256: string;
  contentType: s.FileContentType;
  fileName: string;
  sizeBytes: number;
};

class FileStorage {
  private readonly db: ReturnType<typeof initDb>;

  constructor(d1: D1Database) {
    this.db = initDb(d1);
  }

  async put(userId: string, fileName: string, buffer: Uint8Array<ArrayBuffer>) {
    if (buffer.byteLength === 0)
      throw new HTTPException(400, { message: "File must not be empty" });

    if (buffer.byteLength > MAX_FILE_SIZE_BYTES)
      throw new HTTPException(400, {
        message: `File must be at most ${MAX_FILE_SIZE_BYTES} bytes`,
      });

    const contentType = detectFileContentType(buffer);
    const storedFileName = z
      .string()
      .trim()
      .transform((value) => value.replace(/["\\\r\n]/g, "_"))
      .transform((value) => value || "file")
      .parse(fileName);

    const sha256 = await sha256Hex(buffer);
    const file = {
      id: crypto.randomUUID(),
      userId,
      sha256,
      contentType,
      fileName: storedFileName,
      sizeBytes: buffer.byteLength,
    } satisfies StoredFileMetadata;

    const chunks = chunkBuffer(buffer, FILE_CHUNK_SIZE_BYTES);

    try {
      await this.db.batch([
        this.db.insert(s.files).values(file),
        ...chunks.map((chunk, chunkId) =>
          this.db.insert(s.fileChunks).values({
            fileId: file.id,
            chunkId,
            content: chunk,
          }),
        ),
      ]);
    } catch {
      throw new HTTPException(500, { message: "Failed to store the file" });
    }

    return file;
  }

  async get(fileId: string, userId: string) {
    const meta = await this.getMeta(fileId, userId);
    if (!meta) return null;

    const rows = await this.db
      .select({ content: s.fileChunks.content })
      .from(s.fileChunks)
      .where(eq(s.fileChunks.fileId, meta.id))
      .orderBy(asc(s.fileChunks.chunkId));

    return {
      ...meta,
      buffer: assembleChunks(
        rows.map((row) => new Uint8Array(row.content as any)),
      ),
    };
  }

  async getMeta(fileId: string, userId: string) {
    const validFileIdResult = z.uuid().safeParse(fileId);
    if (!validFileIdResult.success)
      throw new HTTPException(400, { message: "Invalid file ID" });

    const validFileId = validFileIdResult.data;
    return (
      (await this.db
        .select()
        .from(s.files)
        .where(and(eq(s.files.id, validFileId), eq(s.files.userId, userId)))
        .get()) ?? null
    );
  }

  async list(userId: string) {
    return this.db.select().from(s.files).where(eq(s.files.userId, userId));
  }
}

export { FileStorage, MAX_FILE_SIZE_BYTES };
