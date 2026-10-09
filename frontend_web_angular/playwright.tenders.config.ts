import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'tenders.spec.ts',
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:4216',
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env['E2E_CHROME_PATH'] || '/usr/bin/google-chrome',
      args: ['--no-sandbox'],
    },
  },
  webServer: {
    command: 'npm start -- --host 127.0.0.1 --port 4216',
    url: 'http://127.0.0.1:4216',
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
});
