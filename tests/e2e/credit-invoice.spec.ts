import { test, expect } from "@playwright/test";
import { completeSetup, byLabel, goTo, goToByLink } from "./helpers";

/**
 * The Credit Invoice module end to end: billing more than is in stock,
 * tracking the shortfall, delivering it from a later purchase, and
 * cancelling a still-pending bill correctly reverses only what was
 * actually handed over - never the full billed qty.
 */

async function addRamcoCement(page: import("@playwright/test").Page) {
  await goTo(page, "F3", "/products");
  await page.click('button:has-text("Add Product")');
  await page.waitForSelector("text=/^Add Product$/");
  await byLabel(page, "Product Name").fill("Ramco Cement");
  await page.locator('button:has-text("Suggest")').click();
  await byLabel(page, "Purchase Price").fill("300");
  await byLabel(page, "Selling Price").fill("400");
  await byLabel(page, "Opening Stock").fill("30");
  await page.locator('div[role="dialog"] button:has-text("Add product")').click();
  await expect(page.locator("text=Ramco Cement").first()).toBeVisible();
}

async function billRamco(
  page: import("@playwright/test").Page,
  customerName: string,
  phone: string,
) {
  await goTo(page, "F2", "/billing");
  await page
    .locator('input[placeholder="Walk-in customer — type a name or phone"]')
    .fill(customerName);
  await page.locator('input[placeholder="Phone (optional)"]').fill(phone);
  await page.locator('input[placeholder="Number, barcode or name"]').fill("Ramco Cement");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.keyboard.type("40");
  await page.keyboard.press("Enter");
  // Inline warning, doesn't block typing/keyboard flow.
  await expect(page.locator("text=/will be added to Credit Invoice/i")).toBeVisible();
  await expect(page.locator('input[placeholder="Number, barcode or name"]')).toBeFocused();
  await page.keyboard.press("Alt+1");
  await page.keyboard.press("F8"); // save only
  await expect(page.locator("text=/saved/i")).toBeVisible({ timeout: 10000 });
}

test("billing beyond stock creates a Partially Delivered Credit Invoice entry", async ({
  page,
}) => {
  await completeSetup(page);
  await addRamcoCement(page);
  await billRamco(page, "Ramco Test Customer", "9000000001");

  await goToByLink(page, "Credit Invoices", "/credit-invoices");
  await expect(page.locator("text=Ramco Test Customer")).toBeVisible();
  const row = page.locator("tr", { hasText: "Ramco Test Customer" });
  await expect(row).toContainText("40 Bags");
  await expect(row).toContainText("30 Bags");
  await expect(row).toContainText("10 Bags");
  await expect(row).toContainText("Partially Delivered");

  await goTo(page, "F1", "/");
  await expect(page.locator("text=Pending deliveries").locator("..")).toContainText("1");
});

test("a purchase can allocate fresh stock to a customer still owed from an earlier bill", async ({
  page,
}) => {
  await completeSetup(page);
  await addRamcoCement(page);

  await page.locator('nav a:has-text("Suppliers")').click();
  await page.waitForURL((u) => u.pathname.includes("/suppliers"));
  await page.click('button:has-text("Add Supplier")');
  await page.waitForSelector("text=/^Add Supplier$/");
  await byLabel(page, "Name").fill("Ramco Distributors");
  await page.locator('div[role="dialog"] button:has-text("Save")').click();
  await expect(page.locator("text=Ramco Distributors")).toBeVisible();

  await billRamco(page, "Ramco Test Customer", "9000000001");

  await page.locator('nav a:has-text("Purchases")').click();
  await page.waitForURL((u) => u.pathname.includes("/purchases"));
  await page.click('button:has-text("New Purchase")');
  await page.waitForSelector("text=New Purchase");
  await page.locator('input[placeholder="Type supplier name"]').fill("Ramco");
  await page.waitForSelector("text=Ramco Distributors");
  await page.locator("text=Ramco Distributors").click();
  await page.locator('input[placeholder="Product number, barcode or name"]').fill("Ramco Cement");
  await page.waitForSelector('button:has-text("Ramco Cement")');
  await page.locator('button:has-text("Ramco Cement")').click();
  await page.locator('div[role="dialog"] table tbody input').first().fill("10");
  await page.click('button:has-text("Save purchase")');
  await expect(page.locator("text=/saved\\. Stock updated\\./i")).toBeVisible({ timeout: 10000 });

  // The allocation prompt appears automatically, oldest-first, offering to deliver the pending order.
  await page.waitForSelector("text=Allocate to pending deliveries");
  await expect(page.locator("text=Ramco Test Customer — Ramco Cement")).toBeVisible();
  await page.click('button:has-text("Confirm allocation")');
  await expect(page.locator("text=/Delivered to 1 pending order/i")).toBeVisible({
    timeout: 10000,
  });

  // Entry is now fully delivered and the dashboard count drops back to 0.
  await goToByLink(page, "Credit Invoices", "/credit-invoices");
  await page.locator('[role="combobox"]').first().click();
  await page.getByRole("option", { name: "All", exact: true }).click();
  const row = page.locator("tr", { hasText: "Ramco Test Customer" });
  await expect(row).toContainText("DELIVERED");

  await goTo(page, "F1", "/");
  await expect(page.locator("text=Pending deliveries").locator("..")).toContainText("0");
});

test("cancelling a bill with a pending Credit Invoice entry reverses only what was delivered", async ({
  page,
}) => {
  await completeSetup(page);
  await addRamcoCement(page);
  await billRamco(page, "Second Customer", "9000000002");

  // 30 was physically taken, 10 was never deducted - stock should read 0.
  await goTo(page, "F3", "/products");
  await page.locator('input[placeholder*="Search by number"]').fill("Ramco Cement");
  const productRow = page.locator("tr", { hasText: "Ramco Cement" });
  await expect(productRow).toContainText("0 Bags");

  await page.locator('nav a:has-text("Sales")').click();
  await page.waitForURL((u) => u.pathname.includes("/sales"));
  const saleRow = page.locator("tr", { hasText: "Second Customer" });
  await saleRow.locator('button[title="Cancel bill"]').click();
  await page.waitForSelector("text=Cancel this bill?");
  await byLabel(page, "Reason").fill("Customer changed their mind");
  await page.locator('div[role="dialog"] button:has-text("Cancel bill")').click();
  await expect(page.locator("text=/cancelled/i").first()).toBeVisible({ timeout: 10000 });

  // Only the 30 actually handed over comes back - not the full 40 billed qty
  // (which would phantom-inflate stock by the 10 that was never delivered).
  await goTo(page, "F3", "/products");
  await page.locator('input[placeholder*="Search by number"]').fill("Ramco Cement");
  await expect(productRow).toContainText("30 Bags");

  // The entry itself is cancelled, no longer counted as pending.
  await goToByLink(page, "Credit Invoices", "/credit-invoices");
  await page.locator('[role="combobox"]').first().click();
  await page.getByRole("option", { name: "All", exact: true }).click();
  const entryRow = page.locator("tr", { hasText: "Second Customer" });
  await expect(entryRow).toContainText("CANCELLED");
});
