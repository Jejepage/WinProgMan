import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(process.env.REVIEW_URL || 'http://127.0.0.1:5174');
  await page.getByRole('button', { name: 'Load sample data', exact: true }).click();
  await page.locator('.overview-card').first().waitFor();
  await mkdir('test-results/visual', { recursive: true });
  await page.screenshot({ path: 'test-results/visual/overview.png', fullPage: true });
  await page.locator('.overview-card .project-title').first().click();
  await page.locator('.events-panel').getByRole('button', { name: 'Timeline', exact: true }).click();
  await page.screenshot({ path: 'test-results/visual/project.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/visual/mobile.png', fullPage: true });
} finally { await browser.close(); }
