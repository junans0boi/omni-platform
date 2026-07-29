import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function signupAtMobileViewport(page: Page, testInfo: TestInfo, flow: string) {
  const suffix = `${flow}_${Date.now()}_${testInfo.workerIndex}_${testInfo.retry}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  await page.getByPlaceholder("johndoe").fill(`responsive_${suffix}`);
  await page.getByPlaceholder("John Doe").fill("Responsive Test");
  await page.getByPlaceholder("name@example.com").fill(`responsive-${suffix}@example.com`);
  await page.locator('input[type="password"]').fill("responsive-test-password");
  await page.getByRole("button", { name: "Sign Up" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function openMobileNavigation(page: Page) {
  const openNavigation = page.getByRole("button", { name: "Open navigation sidebar" });
  await expect(openNavigation).toBeVisible();
  await openNavigation.click();
}

async function expectInsideViewport(page: Page, testId: string) {
  const bounds = await page.getByTestId(testId).boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height);
}

test("settings modal fits a mobile viewport", async ({ page }, testInfo) => {
  await signupAtMobileViewport(page, testInfo, "settings");
  await openMobileNavigation(page);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const closeSettings = page.getByRole("button", { name: "닫기 (Esc)" });
  await expect(closeSettings).toBeVisible();
  const settingsBounds = await closeSettings.locator("..").boundingBox();
  expect(settingsBounds).not.toBeNull();
  expect(settingsBounds!.width).toBeLessThanOrEqual(390);
  expect(settingsBounds!.height).toBeLessThanOrEqual(844);
  await expect(page.getByRole("heading", { name: "계정", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "음성 및 비디오", exact: true }).click();
  await expect(page.getByRole("heading", { name: "음성 및 비디오", exact: true })).toBeVisible();
});

test("voice channel controls and popovers fit mobile and tablet viewports", async ({ page }, testInfo) => {
  await signupAtMobileViewport(page, testInfo, "voice");
  await openMobileNavigation(page);

  await page.getByRole("button", { name: "Create Space", exact: true }).click();
  await page.getByPlaceholder("Space Name").fill("Responsive QA Space");
  await page.getByRole("button", { name: "Create", exact: true }).click();

  await page.getByRole("button", { name: "Create Channel", exact: true }).click();
  await page.getByRole("button", { name: "VOICE", exact: true }).click();
  await page.getByRole("button", { name: "🎙️ 회의 모드 순서 대기열", exact: true }).click();
  await page.getByPlaceholder("new-channel").fill("responsive-meeting");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "responsive-meeting" }).click();

  await expect(page.getByRole("heading", { name: "responsive-meeting", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const pinnedButton = page.getByTitle("핀 고정 메시지 모아보기");
  await pinnedButton.click();
  await expectInsideViewport(page, "channel-header-drawer");
  await pinnedButton.click();

  const cameraSettingsButton = page.getByTitle("웹캠 가상 배경 & 카메라 설정");
  await cameraSettingsButton.click();
  await expectInsideViewport(page, "camera-settings-popover");
  await page.getByTestId("camera-settings-popover").getByRole("button", { name: "✕" }).click();

  const screenSettingsButton = page.getByTitle("화면 공유 화질 설정");
  await screenSettingsButton.click();
  await expectInsideViewport(page, "screen-settings-popover");
  await page.getByTestId("screen-settings-popover").getByRole("button", { name: "✕" }).click();

  const floorRequestsButton = page.getByTitle("Speaker Requests");
  await floorRequestsButton.click();
  await expectInsideViewport(page, "floor-requests-popover");
  await page.getByTestId("floor-requests-popover").getByRole("button", { name: "✕" }).click();

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole("button", { name: "Toggle channel sidebar" }).click();
  const localTile = page.locator('[data-livekit-video-rendering] [class*="aspect-video"]');
  await expect(localTile).toBeVisible();
  const tabletTileBounds = await localTile.boundingBox();
  expect(tabletTileBounds).not.toBeNull();
  expect(tabletTileBounds!.width).toBeGreaterThanOrEqual(180);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.setViewportSize({ width: 1024, height: 768 });
  const landscapeTileBounds = await localTile.boundingBox();
  expect(landscapeTileBounds).not.toBeNull();
  expect(landscapeTileBounds!.width).toBeGreaterThanOrEqual(180);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("friends view can reopen mobile navigation", async ({ page }, testInfo) => {
  await signupAtMobileViewport(page, testInfo, "friends");
  await openMobileNavigation(page);
  await page.getByRole("button", { name: "친구/DM", exact: true }).click();
  await page.getByRole("button", { name: "사이드바 닫기" }).click();
  const openNavigation = page.getByRole("button", { name: "Open navigation sidebar" });
  await expect(openNavigation).toBeVisible();
  const mobileButtonBounds = await openNavigation.boundingBox();
  expect(mobileButtonBounds).not.toBeNull();
  expect(mobileButtonBounds!.y).toBeGreaterThan(100);

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(openNavigation).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(openNavigation).toBeVisible();
});
