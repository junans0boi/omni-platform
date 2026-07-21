import { expect, test } from "@playwright/test";

test("a new user signs up, receives a safe session, and can log back in", async ({ page }) => {
  const username = "baseline_user";
  const email = "baseline@example.com";
  const password = "baseline-password";

  await page.goto("/signup");
  await page.getByPlaceholder("johndoe").fill(username);
  await page.getByPlaceholder("John Doe").fill("Baseline User");
  await page.getByPlaceholder("name@example.com").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("button", { name: "Create Space" })).toBeVisible();

  const sessionResponse = await page.request.get("/api/auth/me");
  expect(sessionResponse.status()).toBe(200);
  const sessionBody = await sessionResponse.json();
  expect(sessionBody.user).toMatchObject({ username, displayName: "Baseline User" });
  expect(sessionBody.user).not.toHaveProperty("password");
  expect(sessionBody.user).not.toHaveProperty("passwordHash");

  await page.getByTitle("Log Out").click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByPlaceholder("johndoe or name@example.com").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("button", { name: "Create Space" })).toBeVisible();
});
