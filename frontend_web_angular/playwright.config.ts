import { defineConfig, devices } from '@playwright/test';

const retainVisualEvidence = process.env['E2E_CAPTURE'] === 'true';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: retainVisualEvidence ? 'on' : 'only-on-failure',
    video: retainVisualEvidence ? 'on' : 'retain-on-failure',
  },
  webServer: {
    command: 'npm.cmd start -- --host 127.0.0.1',
    url: process.env['E2E_BASE_URL'] ?? 'http://127.0.0.1:4200',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'edge-desktop',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        channel: 'chrome',
      },
    },
    {
      name: 'safari-desktop',
      use: {
        ...devices['Desktop Safari'],
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 15'],
      },
    },
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
      },
    },
  ],
});
