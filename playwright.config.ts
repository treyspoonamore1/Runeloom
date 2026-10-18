import { defineConfig, devices } from '@playwright/test';

// Other agents may be running servers: pick the port with E2E_PORT (default 5174).
const port = Number(process.env.E2E_PORT ?? 5174);
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  use: {
    baseURL: origin,
    ...devices['Desktop Chrome'],
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: origin,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
