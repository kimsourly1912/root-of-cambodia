import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "worker-http",
    environment: "node",
    include: ["tests/worker-http.test.ts", "tests/jobs-runtime.test.ts", "tests/staging-runtime.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
