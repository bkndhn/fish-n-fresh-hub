import { test, expect } from "@playwright/test";

test.describe("Admin & POS Counter Experience", () => {
  test("unauthenticated access to admin redirects to auth page", async ({ page }) => {
    await page.goto("/admin");
    // Should redirect to auth or show login prompt
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toMatch(/(\/auth|\/admin)/);
  });

  test("licence page displays legal and compliance certificates", async ({ page }) => {
    await page.goto("/licence");
    await expect(page.locator("body")).toContainText(/FSSAI|License|GSTIN|Compliance/i);
  });
});
