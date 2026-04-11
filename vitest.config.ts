import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts?(x)"],
    environment: "happy-dom",
  },
});

export const benchConfig = defineConfig({
  test: {
    mode: "benchmark",
    include: ["tests/**/*.bench.ts"],
  },
});
