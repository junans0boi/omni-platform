import { test, expect } from "@playwright/test";

test.describe("Google OAuth UI Flow", () => {
  test("should render Google login button on login page", async ({ page }) => {
    await page.goto("/login");
    const googleButton = page.locator('a[href="/api/auth/google"]');
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toContainText("Google 계정으로 로그인");
  });
});
