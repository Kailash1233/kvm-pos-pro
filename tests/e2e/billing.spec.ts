import { test, expect } from "@playwright/test";
import { completeSetup, byLabel, goTo } from "./helpers";

/**
 * Core billing regression smoke test: covers the GST toggle, the
 * auto-credit-fill, and a full save - the three most likely places for a
 * silent regression to slip through and produce a wrong bill.
 */
test("bills with GST, auto-fills credit, and saves correctly", async ({ page }) => {
  await completeSetup(page);

  await goTo(page, "F3", "/products");
  await page.click('button:has-text("Add Product")');
  await page.waitForSelector("text=/^Add Product$/");
  await byLabel(page, "Product Name").fill("Test Widget");
  await page.locator('button:has-text("Suggest")').click();
  await byLabel(page, "Purchase Price").fill("60");
  await byLabel(page, "Selling Price").fill("100");
  await byLabel(page, "Opening Stock").fill("1000");
  await page.locator('div[role="dialog"] button:has-text("Add product")').click();
  await expect(page.locator("text=Test Widget")).toBeVisible();

  await goTo(page, "F2", "/billing");
  await page.locator('input[placeholder="Number, barcode or name"]').fill("Test Widget");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");

  await page.locator("#cart-qty-0").fill("10"); // 10 x Rs 100 = Rs 1000, +18% GST = Rs 1180
  await page.waitForTimeout(200);
  await expect(page.locator("text=Grand total").locator("..")).toContainText("1,180.00");

  // Cash 700 + UPI 300 -> Credit should auto-fill with the remaining 180.
  const cashInput = page.locator('div:has(> label:text-is("CASH")) input').first();
  const upiInput = page.locator('div:has(> label:text-is("UPI")) input').first();
  const creditInput = page.locator('div:has(> label:text-is("On credit")) input').first();
  await cashInput.fill("700");
  await upiInput.fill("300");
  await expect(creditInput).toHaveValue("180");

  // Credit needs a customer - the save should fail clearly without one.
  await page.keyboard.press("F8");
  await expect(page.locator("text=/credit bills need a customer/i")).toBeVisible();

  await page.locator("#gst-toggle").click(); // switch to a no-GST bill instead
  await expect(page.locator("text=/no gst on this bill/i")).toBeVisible();
  await expect(page.locator("text=Grand total").locator("..")).toContainText("1,000.00");

  await page.keyboard.press("Alt+1"); // full cash now covers the no-GST total exactly
  await page.keyboard.press("F8");
  await expect(page.locator("text=/saved/i")).toBeVisible({ timeout: 10000 });
});
