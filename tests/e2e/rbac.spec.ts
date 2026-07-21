import { expect, test, type Page } from "@playwright/test";

async function signUp(page: Page, username: string, displayName: string) {
  const response = await page.request.post("/api/auth/signup", {
    data: {
      username,
      display_name: displayName,
      email: `${username}@example.com`,
      password: "rbac-password",
    },
  });
  expect(response.status()).toBe(200);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("owner creates, edits, assigns, revokes, and removes a custom role", async ({ page, browser }) => {
  await signUp(page, "rbac_owner", "RBAC Owner");
  const createSpace = await page.request.post("/api/spaces", { data: { name: "RBAC Space" } });
  expect(createSpace.status()).toBe(200);
  const space = await createSpace.json();

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await signUp(memberPage, "rbac_member", "RBAC Member");
  const join = await memberPage.request.put("/api/spaces", { data: { invite_code: space.inviteCode } });
  expect(join.status()).toBe(200);

  await page.goto(`/dashboard/spaces/${space.id}/roles`);
  await page.getByLabel("Role name").fill("Moderators");
  await page.getByLabel("KICK_MEMBERS", { exact: true }).first().check();
  await page.getByRole("button", { name: "Create role" }).click();

  const roleCard = page.getByRole("article").filter({ hasText: "Moderators" });
  await expect(roleCard).toBeVisible();
  await roleCard.getByLabel("RBAC Member").check();
  await expect.poll(async () => {
    const response = await page.request.get(`/api/spaces/${space.id}/roles`);
    const payload = await response.json();
    return payload.roles[0]?.memberships.length;
  }).toBe(1);

  await roleCard.getByLabel("MANAGE_CHANNELS", { exact: true }).check();
  await expect.poll(async () => {
    const response = await page.request.get(`/api/spaces/${space.id}/roles`);
    const payload = await response.json();
    return payload.roles[0]?.permissions.map((item: { permission: string }) => item.permission).sort();
  }).toEqual(["KICK_MEMBERS", "MANAGE_CHANNELS"]);

  await roleCard.getByLabel("RBAC Member").uncheck();
  await roleCard.getByRole("button", { name: "Delete role" }).click();
  await expect(roleCard).toHaveCount(0);
  const details = await page.request.get(`/api/spaces/${space.id}`);
  expect((await details.json()).members.some((member: { profile: { username: string } }) => member.profile.username === "rbac_member")).toBe(true);
  await memberContext.close();
});
