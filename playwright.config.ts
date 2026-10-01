import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  workers: 1, // WebKit shares OPFS across contexts
  retries: 1, // flaky tests get reported as flaky instead of failing the run
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1400, height: 900 } },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1400, height: 900 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1400, height: 900 } } },
  ],
});
