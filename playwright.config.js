// IBVU v5.7 — new file. Settings for the permanent tests (see tests/site.spec.js).
//
// To run the tests on your computer, in the website folder:
//   npm install
//   npx playwright install chromium     (first time only)
//   npm test
// The tests build the site, open it in a hidden browser at laptop and phone
// size, click through it and report anything broken. They only read pages:
// they never send a form and never write to the database.
import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:' + PORT,
    // PW_CHROME lets a machine without Playwright's own browser use an installed Chrome.
    launchOptions: process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {},
  },
  projects: [
    { name: 'laptop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'phone',  use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port ' + PORT + ' --strictPort',
    url: 'http://localhost:' + PORT,
    reuseExistingServer: true,
    timeout: 180000,
  },
});
