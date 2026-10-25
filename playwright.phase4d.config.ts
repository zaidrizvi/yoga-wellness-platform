import { defineConfig } from "@playwright/test";

// Logged-out visual checks only. Existing public catalog reads are permitted;
// no accounts, credentials, uploads or business mutations are created.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "phase4d.spec.ts",
  workers: 1,
  reporter: "list",
  outputDir: "test-results/phase4d",
  use: { baseURL: "http://127.0.0.1:3016", browserName: "chromium", trace: "retain-on-failure" },
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3016",
    url: "http://127.0.0.1:3016/robots.txt",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
