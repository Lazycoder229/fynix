import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*benchmark*.test.ts"],
    environment: "jsdom",
    benchmark: true,
  },
});
