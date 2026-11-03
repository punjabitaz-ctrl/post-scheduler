import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  build: {
    assetsInlineLimit: 1e5,
    cssMinify: true,
    emptyOutDir: true,
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        passes: 5,
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
      },
    },
  },
});
