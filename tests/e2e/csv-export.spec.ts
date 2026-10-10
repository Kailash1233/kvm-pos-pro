import { test, expect } from "@playwright/test";
import { completeSetup, byLabel, goTo, goToByLink } from "./helpers";

/**
 * Covers the CSV/export bug report: every "Export CSV" button used to fire
 * exportCsv() with no feedback at all (void, no toast, no error handling),
 * so on the installed desktop app - where the file is written silently to
 * disk with nothing visible happening - it looked completely broken. These
 * tests confirm a real download actually happens AND a success toast
 * confirms it (the toast is also the only feedback a desktop build gets).
 */

test("Reports page: Export CSV downloads a file and shows a success toast", async ({ page }) => {
  await completeSetup(page);

  await goTo(page, "F3", "/products");
  await page.click('button:has-text("Add Product")');
  await page.waitForSelector("text=/^Add Product$/");
  await byLabel(page, "Product Name").fill("Export Test Product");
  await page.locator('button:has-text("Suggest")').click();
  await byLabel(page, "Purchase Price").fill("50");
  await byLabel(page, "Selling Price").fill("80");
  await byLabel(page, "Opening Stock").fill("100");
  await page.locator('div[role="dialog"] button:has-text("Add product")').click();
  await expect(page.locator("text=Export Test Product").first()).toBeVisible();

  await goToByLink(page, "Reports", "/reports");
  await page.locator('button:has-text("Stock Report")').click();

  const downloadPromise = page.waitForEvent("download");
  await page.locator('button:has-text("Export CSV")').first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Stock Report.csv");
  await expect(page.locator("text=/^Exported:/")).toBeVisible();
});

test("GST page: Export CSV on the Sales Register shows a success toast", async ({ page }) => {
  await completeSetup(page);
  await goToByLink(page, "GST", "/gst");

  // Export is disabled until the register has at least one row, and the
  // Sales Register only lists GST-applied bills - so add a product and
  // bill it with GST on.
  await goTo(page, "F3", "/products");
  await page.click('button:has-text("Add Product")');
  await page.waitForSelector("text=/^Add Product$/");
  await byLabel(page, "Product Name").fill("GST Export Product");
  await page.locator('button:has-text("Suggest")').click();
  await byLabel(page, "Purchase Price").fill("50");
  await byLabel(page, "Selling Price").fill("80");
  await byLabel(page, "Opening Stock").fill("100");
  await page.locator('div[role="dialog"] button:has-text("Add product")').click();
  await expect(page.locator("text=GST Export Product").first()).toBeVisible();

  await goTo(page, "F2", "/billing");
  await page.locator("#gst-toggle").click(); // the Sales Register only lists GST-applied bills
  await page.locator('input[placeholder="Number, barcode or name"]').fill("GST Export Product");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.keyboard.type("2");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Alt+1");
  await page.keyboard.press("F8");
  await expect(page.locator("text=/saved/i")).toBeVisible({ timeout: 10000 });

  await goToByLink(page, "GST", "/gst");
  const downloadPromise = page.waitForEvent("download");
  await page.locator('button:has-text("Export CSV")').first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  await expect(page.locator("text=/^Exported:/")).toBeVisible();
});

test("Customer statement: Export CSV downloads the statement and shows a success toast", async ({
  page,
}) => {
  await completeSetup(page);

  await goToByLink(page, "Customers", "/customers");
  await page.click('button:has-text("Add Customer")');
  await page.waitForSelector("text=/^Add Customer$/");
  await byLabel(page, "Name").fill("Export Statement Customer");
  await page.locator('div[role="dialog"] button:has-text("Save")').click();
  await expect(page.locator("text=Export Statement Customer")).toBeVisible();

  await page.locator("text=Export Statement Customer").click();
  await page.waitForSelector('button:has-text("Export CSV")');

  const downloadPromise = page.waitForEvent("download");
  await page.locator('button:has-text("Export CSV")').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Export Statement Customer-statement.csv");
  await expect(page.locator("text=/^Exported:/")).toBeVisible();
});
