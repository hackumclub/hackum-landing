import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["tests/setup/dom.ts"],
    // A non-UB browser timezone proves UB conversion does not depend on the machine's zone.
    env: { TZ: "America/New_York" },
  },
});
