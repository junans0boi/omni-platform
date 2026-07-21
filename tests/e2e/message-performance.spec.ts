import { expect, test } from "@playwright/test";

test("10,000-message history keeps DOM work bounded while scrolling", async ({ page }) => {
  const startedAt = Date.now();
  await page.goto("/performance/messages");
  await expect(page.getByTestId("message-row").first()).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(5_000);

  const rows = page.getByTestId("message-row");
  expect(await rows.count()).toBeLessThanOrEqual(30);
  const virtualHeight = await page.getByTestId("message-virtual-space").evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(virtualHeight).toBeGreaterThan(500_000);

  const scrollStartedAt = Date.now();
  await page.getByTestId("message-viewport").evaluate((element) => {
    element.scrollTo({ top: element.scrollHeight });
  });
  await expect(page.getByText("Performance message 9999", { exact: true })).toBeVisible();
  expect(Date.now() - scrollStartedAt).toBeLessThan(1_000);
  expect(await rows.count()).toBeLessThanOrEqual(30);
});
