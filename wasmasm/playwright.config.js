const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests/e2e',

  // Fail fast in CI; allow retries locally
  retries: process.env.CI ? 1 : 0,
  workers: 1, // single worker so the dev server isn't overwhelmed

  use: {
    baseURL: 'http://localhost:4000',
    // Grant clipboard access for the Copy Link tests
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Start a static file server against the pre-built dist/ directory.
  // `make build` (or `npm run build` after WASM is compiled) must be run first.
  // reuseExistingServer lets local developers keep `serve` running between test runs.
  webServer: {
    command: 'npx serve -s dist -l 4000',
    port: 4000,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
})
