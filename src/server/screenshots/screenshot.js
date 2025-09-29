import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { CONTENT_DIR } from "../../helpers.js";

const { WEB_EDITOR_APPS_HOSTNAME } = process.env;
const SCREENSHOT_DIR = join(CONTENT_DIR, `__screenshots`);
const SCREENSHOT_TIMEOUT = 10_000;

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const debounce = {};

/**
 * Schedule a screenshot such that successive touches
 * don't trigger multiple screenshots. The code will
 * debounce screenshots using a timeout, and any new
 * request for a screenshot while there's already an
 * outstanding request will simply reset the timeout.
 */
export async function scheduleScreenShot(project) {
  const { slug } = project;
  if (debounce[slug]) clearTimeout(debounce[slug]);
  debounce[slug] = setTimeout(async () => {
    await screenshot(slug);
    delete debounce[slug];
  }, SCREENSHOT_TIMEOUT);
}

/**
 * Use playwright to screenshot this project.
 */
async function screenshot(slug) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1000, height: 600 },
  });
  const page = await context.newPage();
  await page.goto(`https://${slug}.${WEB_EDITOR_APPS_HOSTNAME}`);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const screenshot = join(SCREENSHOT_DIR, `${slug}.png`);
  await page.screenshot({ path: screenshot });
  console.log(`Updated ${screenshot}`);
  await browser.close();
}
