import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "./vitest.backend.config.ts",
      "./vitest.worker.config.ts",
      "./vitest.tooling.config.ts",
    ],
  },
});
