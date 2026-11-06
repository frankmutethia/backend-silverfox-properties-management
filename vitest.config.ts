import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 300_000,
  },
});
