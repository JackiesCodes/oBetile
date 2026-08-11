import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    // Mirrors the "@/*" path alias in tsconfig so tests import modules exactly
    // as the application does.
    alias: { "@": import.meta.dirname },
  },
});
