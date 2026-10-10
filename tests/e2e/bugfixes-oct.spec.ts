import { test, expect } from "@playwright/test";
import { completeSetup, byLabel, goTo } from "./helpers";

/**
 * Covers the specific bug fixes/requests from the follow-up round: the
 * money-input double-paise bug (Opening Balance / Credit Limit), the
 * Purchases GST toggle, and the dashboard privacy mask.
 */

test("Supplier Opening Balance and Customer Credit Limit accept a plain number without runaway growth", async ({
  page,
}) => {
  await completeSetup(page);

  await page.locator('nav a:has-text("Suppliers")').click();
  await page.waitForURL((u) => u.pathname.includes("/suppliers"));
  await page.click('button:has-text("Add Supplier")');
  await page.waitForSelector("text=/^Add Supplier$/");
  await byLabel(page, "Name").fill("Test Supplier");
  const supplierBalance = byLabel(page, "Opening Balance");
  // Real keystroke-by-keystroke typing - this is what actually reproduced
  // the reported bug ("2" -> "200" -> growing on every further key).
  await supplierBalance.click();
  await supplierBalance.pressSequentially("2");
  await expect(supplierBalance).toHaveValue("2");
  await page.locator('div[role="dialog"] button:has-text("Save")').click();
  await expect(page.locator("text=Test Supplier")).toBeVisible();
  await expect(page.locator("tr", { hasText: "Test Supplier" })).not.toContainText("200");

  await page.locator('nav a:has-text("Customers")').click();
  await page.waitForURL((u) => u.pathname.includes("/customers"));
  await page.click('button:has-text("Add Customer")');
  await page.waitForSelector("text=/^Add Customer$/");
  await byLabel(page, "Name").fill("Test Customer");
  const creditLimit = byLabel(page, "Credit Limit");
  await creditLimit.click();
  await creditLimit.pressSequentially("12.5");
  await expect(creditLimit).toHaveValue("12.5");
  // Backspace must shrink the value, not grow it.
  await creditLimit.press("Backspace");
  await expect(creditLimit).toHaveValue("12.");
});

test("Purchases GST toggle removes tax from the purchase total", async ({ page }) => {
  await completeSetup(page);

  await goTo(page, "F3", "/products");
  await page.click('button:has-text("Add Product")');
  await page.waitForSelector("text=/^Add Product$/");
  await byLabel(page, "Product Name").fill("Cement Bag");
  await page.locator('button:has-text("Suggest")').click();
  await byLabel(page, "Purchase Price").fill("300");
  await byLabel(page, "Selling Price").fill("400");
  await page.locator('div[role="dialog"] button:has-text("Add product")').click();
  await expect(page.locator("text=Cement Bag").first()).toBeVisible();

  await page.locator('nav a:has-text("Suppliers")').click();
  await page.waitForURL((u) => u.pathname.includes("/suppliers"));
  await page.click('button:has-text("Add Supplier")');
  await page.waitForSelector("text=/^Add Supplier$/");
  await byLabel(page, "Name").fill("GST Test Supplier");
  await page.locator('div[role="dialog"] button:has-text("Save")').click();
  await expect(page.locator("text=GST Test Supplier")).toBeVisible();

  await page.locator('nav a:has-text("Purchases")').click();
  await page.waitForURL((u) => u.pathname.includes("/purchases"));
  await page.click('button:has-text("New Purchase")');
  await page.waitForSelector("text=New Purchase");
  await page.locator('input[placeholder="Type supplier name"]').fill("GST Test");
  await page.waitForSelector("text=GST Test Supplier");
  await page.locator("text=GST Test Supplier").click();
  await page.locator('input[placeholder="Product number, barcode or name"]').fill("Cement Bag");
  await page.waitForSelector('button:has-text("Cement Bag")');
  await page.locator('button:has-text("Cement Bag")').click();

  // GST on by default: 300 + 18% = 354.
  await expect(page.locator("text=Total: ₹354.00")).toBeVisible();

  await page.locator('[role="switch"]').click();
  await expect(page.locator("text=Total: ₹300.00")).toBeVisible();
});

test("dashboard figures are masked by default and revealed with the eye icon", async ({ page }) => {
  await completeSetup(page);
  await goTo(page, "F1", "/");

  await expect(page.locator("text=Today's sales").locator("..")).toContainText("XXXX");
  await page.click('button[title="Show numbers"]');
  await expect(page.locator("text=Today's sales").locator("..")).toContainText("₹");
  await expect(page.locator("text=Today's sales").locator("..")).not.toContainText("XXXX");
});
