import { writeFile } from "node:fs/promises";
export async function ensurePlaywrightConfig() {
  const cfg = `import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.vibe/tests',
  use: { baseURL: process.env.BASE_URL || 'http://localhost:3000', headless: true },
});`;
  await writeFile("playwright.config.ts", cfg);
}
