const { defineConfig, devices } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 90000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:8765" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "iphone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "webkit" },
    },
  ],
  webServer: {
    command: "python3 -m http.server 8765 --bind 127.0.0.1",
    port: 8765,
    reuseExistingServer: true,
  },
});
