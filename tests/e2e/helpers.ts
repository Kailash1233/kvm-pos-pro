import type { Page } from "@playwright/test";

export function byLabel(page: Page, labelText: string) {
  return page
    .locator(`div:has(> label:text-is("${labelText}"))`)
    .locator("input, textarea")
    .first();
}

/** Runs first-time setup and signs in as the new owner. Every test starts from a blank database. */
export async function completeSetup(
  page: Page,
  opts: { businessName?: string; gstin?: string; username?: string; password?: string } = {},
) {
  const businessName = opts.businessName ?? "Test Hardware Co";
  const gstin = opts.gstin ?? "29ABCDE1234F1Z5";
  const username = opts.username ?? "owner";
  const password = opts.password ?? "password123";

  // Force a clean slate: Chromium can keep an IndexedDB connection alive
  // across test files sharing one browser process, which otherwise makes
  // this test's "fresh install" collide with state left over from another.
  await page.goto("/");
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.deleteDatabase("kvm-agencies");
        req.onsuccess = req.onerror = req.onblocked = () => resolve(undefined);
      }),
  );
  await page.reload();
  await page.waitForSelector("text=First time setup", { timeout: 15000 });
  await byLabel(page, "Shop name").fill(businessName);
  await byLabel(page, "GSTIN").fill(gstin);
  await page.locator('div:has(> label:text-is("State")) input').fill("Karnataka");
  await page.locator('div:has(> label:text-is("Code")) input').fill("29");
  await page.click('button:has-text("Continue")');
  await page.waitForSelector("text=Owner name");
  await byLabel(page, "Owner name").fill("Test Owner");
  await byLabel(page, "Username").fill(username);
  const pw = page.locator('input[type="password"]');
  await pw.nth(0).fill(password);
  await pw.nth(1).fill(password);
  await page.click('button:has-text("Continue")');
  await page.waitForSelector("text=Ready to go");
  await page.click('button:has-text("Finish setup")');
  await page.waitForSelector("text=" + businessName, { timeout: 15000 });
  return { businessName, gstin, username, password };
}

/**
 * Client-side route change via the app's own keyboard shortcut, instead of
 * page.goto(): a hard navigation re-runs SSR and re-hydrates from scratch,
 * which raced against this client-only, IndexedDB-backed app's readiness
 * check often enough in practice to be worth just avoiding entirely.
 */
export async function goTo(page: Page, key: "F1" | "F2" | "F3" | "F4", urlContains: string) {
  await page.keyboard.press(key);
  await page.waitForURL((url) => url.pathname.includes(urlContains), { timeout: 10000 });
}

/** Client-side nav via the sidebar link text, for routes with no F-key shortcut. */
export async function goToByLink(page: Page, linkText: string, urlContains: string) {
  await page.locator(`nav a:has-text("${linkText}")`).click();
  await page.waitForURL((url) => url.pathname.includes(urlContains), { timeout: 10000 });
}

/**
 * printInvoice() builds the bill as HTML in a hidden iframe, appended to the
 * page and removed again 1.5s later - read its text content right after
 * triggering print, while it's still there.
 */
export async function printedText(page: Page): Promise<string> {
  await page.waitForSelector("iframe", { state: "attached", timeout: 5000 });
  await page.waitForFunction(
    () => {
      const frames = Array.from(document.querySelectorAll("iframe"));
      const frame = frames[frames.length - 1] as HTMLIFrameElement | undefined;
      return !!frame?.contentDocument?.body?.innerText;
    },
    { timeout: 5000 },
  );
  return page.evaluate(() => {
    const frames = Array.from(document.querySelectorAll("iframe"));
    const frame = frames[frames.length - 1] as HTMLIFrameElement | undefined;
    return frame?.contentDocument?.body?.innerText ?? "";
  });
}
