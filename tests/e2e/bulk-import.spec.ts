import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { completeSetup, goTo } from "./helpers";

/**
 * Stress-tests product management "beyond a small demo set": a real shop
 * catalogue can run into the hundreds or thousands of SKUs. This imports
 * a large batch in one go and checks the app stays correct - not just
 * fast - at that scale: valid rows are added, invalid ones are rejected
 * with a reason (not silently dropped or silently overwritten), and a
 * specific product is still findable afterwards.
 */

const BATCH_SIZE = 500;

function buildCsv(rows: Record<string, string | number>[]): string {
  const headers = [
    "Product Number",
    "Product Name",
    "Category",
    "Subcategory",
    "Brand",
    "Unit",
    "Purchase Price",
    "Retail Price",
    "Dealer Price",
    "Contractor Price",
    "GST",
    "HSN",
    "Opening Stock",
    "Minimum Stock",
    "Barcode",
    "Image URL",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => String(r[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

test("importing 500 products at once stays correct, not just fast", async ({ page }) => {
  await completeSetup(page);

  const categories = ["Hardware", "Electrical", "Plumbing", "Paint", "Steel"];
  const rows = [];
  for (let i = 0; i < BATCH_SIZE; i++) {
    rows.push({
      "Product Number": `STRESS-${i}`,
      "Product Name": `Stress Test Item ${i}`,
      Category: categories[i % categories.length],
      Brand: `Brand${i % 20}`,
      Unit: "Piece",
      "Purchase Price": 10 + (i % 100),
      "Retail Price": 15 + (i % 100),
      GST: [0, 5, 12, 18, 28][i % 5],
      "Opening Stock": i % 50,
      "Minimum Stock": 5,
    });
  }
  // A handful of deliberately bad rows mixed in, so validation is exercised at scale too:
  rows.push({
    "Product Number": "",
    "Product Name": "Missing number",
    "Retail Price": 10,
    GST: 18,
  });
  rows.push({
    "Product Number": "STRESS-1", // duplicate of an already-valid row above
    "Product Name": "Duplicate of STRESS-1",
    "Retail Price": 10,
    GST: 18,
  });

  const csvPath = path.join(os.tmpdir(), `stress-import-${Date.now()}.csv`);
  fs.writeFileSync(csvPath, buildCsv(rows));

  await goTo(page, "F3", "/products");
  await page.click('button:has-text("Import")');
  await page.waitForSelector("text=Import Products");

  const fileInput = page.locator('input[type="file"][accept*="csv"]');
  const start = Date.now();
  await fileInput.setInputFiles(csvPath);

  await expect(page.locator("text=/ready to import/i")).toContainText(String(BATCH_SIZE));
  await expect(page.locator("text=/will be skipped/i")).toContainText("2");

  await page.click(`button:has-text("Import ${BATCH_SIZE} products")`);
  await expect(page.locator("text=/product.*added/i")).toContainText(String(BATCH_SIZE), {
    timeout: 30000,
  });
  const elapsedMs = Date.now() - start;
  console.log(
    `Imported ${BATCH_SIZE} products in ${elapsedMs}ms (including parse + preview render)`,
  );

  await page.click('button:has-text("Done")');

  // The catalogue is now well beyond the old ~30-item demo scale - confirm a
  // specific item deep in the batch is still findable, not just the first few.
  await page.fill('input[placeholder*="Search by number"]', "STRESS-499");
  await expect(page.locator("text=Stress Test Item 499")).toBeVisible();

  // And that the rejected duplicate did NOT overwrite the original.
  await page.fill('input[placeholder*="Search by number"]', "STRESS-1");
  const matches = await page.locator("text=/Stress Test Item 1$/").count();
  expect(matches).toBe(1);
});
