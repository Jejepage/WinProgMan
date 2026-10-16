import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // Rust build outputs contain locked executables and must not be watched.
  server: { watch: { ignored: ["**/src-tauri/**"] } },
  test: { include: ["src/**/*.test.ts", "tests/**/*.test.ts"] },
});
