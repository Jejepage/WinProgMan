import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react()],
  resolve: {
    // msgreader only needs iconv-lite for ANSI code pages; use TextDecoder.
    alias: {
      "iconv-lite": fileURLToPath(
        new URL("./src/features/outlook/iconvShim.ts", import.meta.url),
      ),
    },
  },
  // Rust build outputs contain locked executables and must not be watched.
  server: { watch: { ignored: ["**/src-tauri/**"] } },
  test: { include: ["src/**/*.test.ts", "tests/**/*.test.ts"] },
});
