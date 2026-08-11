import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    // Mirrors the "@/*" path alias in tsconfig so tests import modules exactly
    // as the application does.
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
