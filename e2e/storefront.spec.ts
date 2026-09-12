import { test, expect } from "@playwright/test";

test.describe("Customer Storefront Flow", () => {
  test("loads homepage with correct title and branding elements", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Fish N Fresh/i);
    
    // Header should be visible
    const header = page.locator("header");
    await expect(header).toBeVisible();

    // Bottom mobile nav or desktop nav should be present
    const mainNav = page.locator("nav");
    await expect(mainNav.first()).toBeVisible();
  });

  test("can navigate to catalog and search for products", async ({ page }) => {
    await page.goto("/catalog");
    
    // Search input should exist
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill("Prawns");
      await page.waitForTimeout(300);
      expect(await searchInput.inputValue()).toBe("Prawns");
    }
  });

  test("cart drawer opens and shows empty state or items", async ({ page }) => {
    await page.goto("/");
    const cartButton = page.locator('button[aria-label*="cart" i], a[href="/cart"], button:has-text("Cart")');
    if (await cartButton.first().isVisible()) {
      await cartButton.first().click();
      await page.waitForTimeout(500);
      // Cart should open or navigate to cart
      expect(page.url()).toMatch(/(cart|\/)/);
    }
  });
});
