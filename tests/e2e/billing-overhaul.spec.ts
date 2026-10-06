import { test, expect } from "@playwright/test";
import { completeSetup, byLabel, goTo, printedText } from "./helpers";

/**
 * Covers the big billing-module overhaul: GST off by default, the
 * customer-name print bug fix, the new keyboard flow, weight-based (kg)
 * pricing, and the transport-charge line. The Credit Invoice module itself
 * (billing beyond stock) is covered separately in credit-invoice.spec.ts.
 */

async function addProduct(
  page: import("@playwright/test").Page,
  opts: { name: string; purchasePrice: string; sellingPrice: string; openingStock: string },
) {
  await goTo(page, "F3", "/products");
  await page.click('button:has-text("Add Product")');
  await page.waitForSelector("text=/^Add Product$/");
  await byLabel(page, "Product Name").fill(opts.name);
  await page.locator('button:has-text("Suggest")').click();
  await byLabel(page, "Purchase Price").fill(opts.purchasePrice);
  await byLabel(page, "Selling Price").fill(opts.sellingPrice);
  await byLabel(page, "Opening Stock").fill(opts.openingStock);
  await page.locator('div[role="dialog"] button:has-text("Add product")').click();
  await expect(page.locator(`text=${opts.name}`).first()).toBeVisible();
}

test("GST is off by default and a true walk-in bill prints with no name, no GSTIN, no tax table", async ({
  page,
}) => {
  await completeSetup(page);
  await addProduct(page, {
    name: "Plain Nail Box",
    purchasePrice: "50",
    sellingPrice: "80",
    openingStock: "100",
  });

  await goTo(page, "F2", "/billing");
  // Off by default (settings.defaultGstApplied defaults to false).
  await expect(page.locator("#gst-toggle")).toHaveAttribute("aria-checked", "false");

  await page.locator('input[placeholder="Number, barcode or name"]').fill("Plain Nail Box");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");

  // Focus must land on the new line's qty input with its value selected,
  // ready to overtype - and Enter there goes straight back to search.
  await expect(page.locator("#cart-qty-0")).toBeFocused();
  await page.keyboard.type("5");
  await page.keyboard.press("Enter");
  await expect(page.locator('input[placeholder="Number, barcode or name"]')).toBeFocused();

  await page.keyboard.press("Alt+1"); // full cash
  await page.keyboard.press("F9"); // save & print
  await expect(page.locator("text=/saved/i")).toBeVisible({ timeout: 10000 });

  const invoiceToast = await page.locator("text=/saved/i").innerText();
  expect(invoiceToast).toContain("EST-");

  const printed = await printedText(page);
  expect(printed).toContain("ESTIMATE");
  expect(printed).not.toContain("TAX INVOICE");
  expect(printed).not.toContain("GSTIN");
  expect(printed).not.toContain("Bill To");
});

test("a typed customer name that doesn't match any record still prints correctly (the reported bug)", async ({
  page,
}) => {
  await completeSetup(page);
  await addProduct(page, {
    name: "Copper Wire Roll",
    purchasePrice: "200",
    sellingPrice: "300",
    openingStock: "50",
  });

  await goTo(page, "F2", "/billing");
  await page
    .locator('input[placeholder="Walk-in customer — type a name or phone"]')
    .fill("Suresh Kumar");
  await page.locator('input[placeholder="Phone (optional)"]').fill("9123456780");

  await page.locator('input[placeholder="Number, barcode or name"]').fill("Copper Wire Roll");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.keyboard.type("2");
  await page.keyboard.press("Enter");

  await page.keyboard.press("Alt+1");
  await page.keyboard.press("F9");
  await expect(page.locator("text=/saved/i")).toBeVisible({ timeout: 10000 });

  const printed = await printedText(page);
  expect(printed).toContain("Suresh Kumar");
  expect(printed).toContain("9123456780");
});

test("GST on with a selected customer prints a full tax invoice", async ({ page }) => {
  await completeSetup(page);
  await addProduct(page, {
    name: "Steel Hinge Set",
    purchasePrice: "40",
    sellingPrice: "70",
    openingStock: "60",
  });

  // Create the customer first, via Customers, so billing can select a real match.
  await page.locator('nav a:has-text("Customers")').click();
  await page.waitForURL((u) => u.pathname.includes("/customers"));
  await page.click('button:has-text("Add Customer")');
  await page.waitForSelector("text=/^Add Customer$/");
  await byLabel(page, "Name").fill("Lakshmi Traders");
  await byLabel(page, "Phone").fill("9988776655");
  await page.locator('div[role="dialog"] button:has-text("Save")').click();
  await expect(page.locator("text=Lakshmi Traders")).toBeVisible();

  await goTo(page, "F2", "/billing");
  await page.locator("#gst-toggle").click(); // turn GST on for this bill
  await expect(page.locator("#gst-toggle")).toHaveAttribute("aria-checked", "true");

  await page
    .locator('input[placeholder="Walk-in customer — type a name or phone"]')
    .fill("Lakshmi");
  await page.waitForSelector("text=Lakshmi Traders");
  await page.locator("text=Lakshmi Traders").click();

  await page.locator('input[placeholder="Number, barcode or name"]').fill("Steel Hinge Set");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.keyboard.type("3");
  await page.keyboard.press("Enter");

  await page.keyboard.press("Alt+1");
  await page.keyboard.press("F9");
  await expect(page.locator("text=/saved/i")).toBeVisible({ timeout: 10000 });

  const invoiceToast = await page.locator("text=/saved/i").innerText();
  expect(invoiceToast).toContain("INV-");

  const printed = await printedText(page);
  expect(printed).toContain("TAX INVOICE");
  expect(printed).toContain("GSTIN");
  expect(printed).toContain("Lakshmi Traders");
});

test("a kg-priced product bills by weight and transport charges add to the total after GST", async ({
  page,
}) => {
  await completeSetup(page);

  await goTo(page, "F3", "/products");
  await page.click('button:has-text("Add Product")');
  await page.waitForSelector("text=/^Add Product$/");
  await byLabel(page, "Product Name").fill("TMT Steel Rod");
  await page.locator('button:has-text("Suggest")').click();
  await page.locator('div[role="dialog"] button:has-text("Per Unit (Qty x Rate)")').click();
  await page.locator('[role="option"]:has-text("Per Kg (Weight x Rate/kg)")').click();
  await byLabel(page, "Purchase Price").fill("50");
  await byLabel(page, "Selling Price").fill("68");
  await byLabel(page, "Opening Stock").fill("500");
  await page.locator('div[role="dialog"] button:has-text("Add product")').click();
  await expect(page.locator("text=TMT Steel Rod").first()).toBeVisible();

  await goTo(page, "F2", "/billing");
  await page.locator('input[placeholder="Number, barcode or name"]').fill("TMT Steel Rod");
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");

  // Weight field (same underlying id as "qty"), decimals allowed.
  await expect(page.locator("#cart-qty-0")).toBeFocused();
  await page.keyboard.type("1.5");
  await page.keyboard.press("Enter");

  // Amount = 1.5 x 68.00 = 102.00, live.
  await expect(page.locator("text=Grand total").locator("..")).toContainText("102.00");

  // Transport charge, typed custom amount.
  await page
    .locator('div:has(> label:text-is("Transport Charges (Vandi Vadagai)")) input')
    .fill("300");
  await expect(page.locator("text=Grand total").locator("..")).toContainText("402.00");

  await page.keyboard.press("Alt+1");
  await page.keyboard.press("F9");
  await expect(page.locator("text=/saved/i")).toBeVisible({ timeout: 10000 });

  const printed = await printedText(page);
  expect(printed).toMatch(/1\.500\s*kg/);
  expect(printed).toContain("68.00/kg");
  expect(printed).toContain("Transport Charges (Vandi Vadagai)");
  expect(printed).toContain("402.00");
});
