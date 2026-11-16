import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  // First hit of a route compiles it in `next dev`; allow for that cold start.
  timeout: 90_000,
  outputDir: ".playwright-mcp/e2e-results",
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Desktop Chrome"] },
  // Reuses a running `next dev --port 3100`; starts one otherwise.
  webServer: { command: `npx next dev --port ${PORT}`, url: `http://localhost:${PORT}/mn`, reuseExistingServer: true, timeout: 180_000 },
});
