import { expect, test } from "@playwright/test";

test("a new user signs up, receives a safe session, and can log back in", async ({ page }, testInfo) => {
  const username = `baseline_user_${testInfo.retry}`;
  const email = `baseline-${testInfo.retry}@example.com`;
  const password = "baseline-password";

  await page.goto("/signup");
  await page.getByPlaceholder("johndoe").fill(username);
  await page.getByPlaceholder("John Doe").fill("Baseline User");
  await page.getByPlaceholder("name@example.com").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign Up" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("button", { name: "Create Space" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Select space" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle color theme" })).toHaveCount(0);

  await page.getByRole("button", { name: "Create Space" }).click();
  await page.getByPlaceholder("Space Name").fill("Baseline Space");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Select space" })).toHaveValue(/.+/);
  await expect(page.getByRole("combobox", { name: "Select space" }).locator("option")).toHaveCount(2);

  const membersButton = page.getByRole("button", { name: "View members" });
  await membersButton.click();
  const membersDialog = page.getByRole("dialog", { name: "Members" });
  await expect(membersDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(membersDialog).toBeHidden();
  await expect(membersButton).toBeFocused();

  await page.getByRole("button", { name: "My Profile" }).click();
  await expect(page.getByRole("group", { name: "Sound effects" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Sound effects volume" })).toHaveValue("35");
  await page.getByRole("checkbox", { name: "Enable sound effects" }).uncheck();
  await page.getByRole("button", { name: "Cancel" }).click();

  const sessionResponse = await page.request.get("/api/auth/me");
  expect(sessionResponse.status()).toBe(200);
  const sessionBody = await sessionResponse.json();
  expect(sessionBody.user).toMatchObject({ username, displayName: "Baseline User" });
  expect(sessionBody.user).not.toHaveProperty("password");
  expect(sessionBody.user).not.toHaveProperty("passwordHash");

  await page.getByTitle("Log Out").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByPlaceholder("johndoe or name@example.com").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("button", { name: "Create Space" })).toBeVisible();
});
