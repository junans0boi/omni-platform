import { expect, test } from "@playwright/test";

test.use({ locale: "ko-KR" });

test("detects browser language and persists a manual locale choice", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByRole("heading", { name: "다시 오신 것을 환영합니다" })).toBeVisible();

  const response = await page.request.post("/api/locale", { data: { locale: "en" } });
  expect(response.status()).toBe(200);
  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
