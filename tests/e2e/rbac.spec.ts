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

test("owner creates, edits, assigns, revokes, and removes a custom role", async ({ page, browser }, testInfo) => {
  const nonce = `${Date.now()}_${testInfo.retry}`;
  const ownerUsername = `rbac_owner_${nonce}`;
  const memberUsername = `rbac_member_${nonce}`;
  await signUp(page, ownerUsername, "RBAC Owner");
  const createSpace = await page.request.post("/api/spaces", { data: { name: "RBAC Space" } });
  expect(createSpace.status()).toBe(200);
  const space = await createSpace.json();

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await signUp(memberPage, memberUsername, "RBAC Member");
  const join = await memberPage.request.put("/api/spaces", { data: { invite_code: space.inviteCode } });
  expect(join.status()).toBe(200);
  const spaceDetails = await page.request.get(`/api/spaces/${space.id}`);
  const channelId = (await spaceDetails.json()).channels.find((channel: { type: string }) => channel.type === "TEXT").id;
  const deniedMention = await memberPage.request.post(`/api/channels/${channelId}/messages`, {
    data: { content: "@everyone denied", mentions: [{ kind: "EVERYONE" }] },
  });
  expect(deniedMention.status()).toBe(403);

  await page.goto(`/dashboard/spaces/${space.id}/roles`);
  await page.getByLabel("Role name").fill("Moderators");
  await page.getByLabel("Color").first().fill("#ff0000");
  await page.getByLabel("Badge").first().selectOption("moderator");
  await page.getByLabel("Display position").first().fill("5");
  await page.getByLabel("KICK_MEMBERS", { exact: true }).first().check();
  await page.getByLabel("MENTION_EVERYONE", { exact: true }).first().check();
  await page.getByRole("button", { name: "Create role" }).click();

  const roleCard = page.getByRole("article").filter({ hasText: "Moderators" });
  await expect(roleCard).toBeVisible();
  await expect(roleCard.getByLabel("moderator badge")).toBeVisible();
  await roleCard.getByLabel("RBAC Member").check();
  await expect.poll(async () => {
    const response = await page.request.get(`/api/spaces/${space.id}/roles`);
    const payload = await response.json();
    return payload.roles[0]?.memberships.length;
  }).toBe(1);
  const allowedMention = await memberPage.request.post(`/api/channels/${channelId}/messages`, {
    data: { content: "@everyone allowed", mentions: [{ kind: "EVERYONE" }] },
  });
  expect(allowedMention.status()).toBe(200);
  expect((await allowedMention.json()).mentions[0].recipients).toHaveLength(2);

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "View members" }).click();
  // Scope to the Members dialog to avoid strict mode violation — the badge label
  // also appears on message-row role chips in the channel feed.
  const membersDialog = page.getByRole("dialog", { name: "Members" });
  await expect(membersDialog.getByLabel("Moderators role, moderator badge")).toBeVisible();
  await page.goto(`/dashboard/spaces/${space.id}/roles`);
  const refreshedRoleCard = page.getByRole("article").filter({ hasText: "Moderators" });

  await refreshedRoleCard.getByLabel("MANAGE_CHANNELS", { exact: true }).check();
  await expect.poll(async () => {
    const response = await page.request.get(`/api/spaces/${space.id}/roles`);
    const payload = await response.json();
    return payload.roles[0]?.permissions.map((item: { permission: string }) => item.permission).sort();
  }).toEqual(["KICK_MEMBERS", "MANAGE_CHANNELS", "MENTION_EVERYONE"]);

  await refreshedRoleCard.getByLabel("RBAC Member").uncheck();
  await refreshedRoleCard.getByRole("button", { name: "Delete role" }).click();
  await expect(refreshedRoleCard).toHaveCount(0);
  const details = await page.request.get(`/api/spaces/${space.id}`);
  expect((await details.json()).members.some((member: { profile: { username: string } }) => member.profile.username === memberUsername)).toBe(true);
  await memberContext.close();
});

test("@here returns only online recipients and denied global mention writes no message", async ({ browser }, testInfo) => {
  const nonce = `${Date.now()}_${testInfo.retry}`;
  const ownerCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  const memberPage = await memberCtx.newPage();

  const ownerRes = await ownerPage.request.post("/api/auth/signup", {
    data: { username: `here_owner_${nonce}`, display_name: "Here Owner", email: `here_owner_${nonce}@example.com`, password: "here-password" },
  });
  expect(ownerRes.status()).toBe(200);
  const memberRes = await memberPage.request.post("/api/auth/signup", {
    data: { username: `here_member_${nonce}`, display_name: "Here Member", email: `here_member_${nonce}@example.com`, password: "here-password" },
  });
  expect(memberRes.status()).toBe(200);

  const spaceRes = await ownerPage.request.post("/api/spaces", { data: { name: "Here Space" } });
  expect(spaceRes.status()).toBe(200);
  const space = await spaceRes.json() as { id: string; inviteCode: string };
  expect((await memberPage.request.put("/api/spaces", { data: { invite_code: space.inviteCode } })).status()).toBe(200);
  const spaceData = await (await ownerPage.request.get(`/api/spaces/${space.id}`)).json() as {
    channels: Array<{ id: string; type: string }>;
  };
  const channelId = spaceData.channels.find((c) => c.type === "TEXT")!.id;

  // Member lacks MENTION_EVERYONE → @here returns 403; verify no message is persisted
  const hereDenied = await memberPage.request.post(`/api/channels/${channelId}/messages`, {
    data: { content: "@here denied", mentions: [{ kind: "HERE" }] },
  });
  expect(hereDenied.status()).toBe(403);
  const listAfterDeny = await (await ownerPage.request.get(`/api/channels/${channelId}/messages`)).json() as {
    items: Array<{ content: string }>;
  };
  expect(listAfterDeny.items.some((m) => m.content === "@here denied")).toBe(false);

  // Owner (OWNER role → always allowed) sends @here; E2E has no Realtime presence so 0 online members
  const hereAllowed = await ownerPage.request.post(`/api/channels/${channelId}/messages`, {
    data: { content: "@here snapshot", mentions: [{ kind: "HERE" }] },
  });
  expect(hereAllowed.status()).toBe(200);
  const hereBody = await hereAllowed.json() as { mentions: Array<{ recipients: unknown[] }> };
  // No WebSocket connections in E2E → presenceSnapshot is empty → @here = 0 recipients
  expect(hereBody.mentions[0].recipients).toHaveLength(0);

  await ownerCtx.close();
  await memberCtx.close();
});
