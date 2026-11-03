import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./backend/db.ts",
  out: "./migrations",
  dialect: "sqlite",
});
