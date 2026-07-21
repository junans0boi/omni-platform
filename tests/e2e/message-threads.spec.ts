import { expect, test, type BrowserContext } from "@playwright/test";

async function createUser(context: BrowserContext, username: string) {
  const response = await context.request.post("/api/auth/signup", {
    data: {
      username,
      display_name: username,
      email: `${username}@example.com`,
      password: "thread-e2e-password",
    },
  });
  expect(response.status()).toBe(200);
}

test("two members reply and maintain a private thread across update, reconnect, and tombstone", async ({ browser }, testInfo) => {
  const suffix = `${Date.now()}_${testInfo.retry}`;
  const contextA = await browser.newContext({ baseURL: "http://localhost:3100" });
  const contextB = await browser.newContext({ baseURL: "http://localhost:3100" });
  const contextC = await browser.newContext({ baseURL: "http://localhost:3100" });
  await createUser(contextA, `thread_a_${suffix}`);
  await createUser(contextB, `thread_b_${suffix}`);
  await createUser(contextC, `thread_c_${suffix}`);

  const spaceResponse = await contextA.request.post("/api/spaces", { data: { name: "Thread Space" } });
  expect(spaceResponse.status()).toBe(200);
  const space = await spaceResponse.json() as { id: string; inviteCode: string };
  expect((await contextB.request.put("/api/spaces", { data: { invite_code: space.inviteCode } })).status()).toBe(200);
  const spaceDetails = await (await contextA.request.get(`/api/spaces/${space.id}`)).json() as {
    channels: Array<{ id: string; type: string }>;
  };
  const channelId = spaceDetails.channels.find((channel) => channel.type === "TEXT")!.id;

  const rootResponse = await contextA.request.post(`/api/channels/${channelId}/messages`, {
    data: { content: "durable thread root" },
  });
  expect(rootResponse.status()).toBe(200);
  const root = await rootResponse.json() as { id: string };

  expect((await contextC.request.get(`/api/channels/${channelId}/messages/${root.id}/thread`)).status()).toBe(403);

  const secondSpace = await (await contextA.request.post("/api/spaces", { data: { name: "Other Space" } })).json() as { id: string };
  const secondDetails = await (await contextA.request.get(`/api/spaces/${secondSpace.id}`)).json() as {
    channels: Array<{ id: string; type: string }>;
  };
  const secondChannelId = secondDetails.channels.find((channel) => channel.type === "TEXT")!.id;
  const crossChannel = await contextA.request.post(`/api/channels/${secondChannelId}/messages`, {
    data: { content: "invalid cross-channel reply", replyToId: root.id },
  });
  expect(crossChannel.status()).toBe(400);
  expect(await crossChannel.json()).toMatchObject({ error: "cross_channel_reference" });

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  // Navigate to dashboard and explicitly select the Thread Space by ID, because
  // contextA owns two spaces (Thread Space + Other Space) and auto-select may
  // pick the wrong one, leaving the message list empty.
  await pageA.goto("/dashboard");
  await pageB.goto("/dashboard");
  const spaceComboA = pageA.getByRole("combobox", { name: "Select space" });
  const spaceComboB = pageB.getByRole("combobox", { name: "Select space" });
  await expect(spaceComboA).toBeVisible({ timeout: 15_000 });
  await expect(spaceComboB).toBeVisible({ timeout: 15_000 });
  await spaceComboA.selectOption({ value: space.id });
  await spaceComboB.selectOption({ value: space.id });
  const rootRowA = pageA.getByTestId("message-row").filter({ hasText: "durable thread root" });
  const rootRowB = pageB.getByTestId("message-row").filter({ hasText: "durable thread root" });
  await expect(rootRowA).toBeVisible({ timeout: 15_000 });
  await expect(rootRowB).toBeVisible({ timeout: 15_000 });

  await rootRowB.getByRole("button", { name: "Reply to message" }).click();
  const messageInput = pageB.locator('input[placeholder^="Message #"]');
  await messageInput.fill("inline reply stays in feed");
  await messageInput.press("Enter");
  const inlineRow = pageB.getByTestId("message-row").filter({ hasText: "inline reply stays in feed" });
  await expect(inlineRow).toContainText("durable thread root");
  // The reply reference button (first button in the row) shows the original author name.
  await expect(inlineRow.getByRole("button").first()).toContainText("thread_a_");

  const nestedReplyResponse = await contextA.request.post(`/api/channels/${channelId}/messages`, {
    data: { content: "invalid nested reply", replyToId: (await inlineRow.getAttribute("data-message-id"))! },
  });
  expect(nestedReplyResponse.status()).toBe(400);
  expect(await nestedReplyResponse.json()).toMatchObject({ error: "nested_thread_reference" });

  // After the inline reply, the rootRow filter also matches the inline reply row (which
  // quotes "durable thread root"), so scope the button click to the first matched row.
  await rootRowB.first().getByRole("button", { name: "Open thread" }).click();
  const panelB = pageB.getByRole("dialog", { name: /Thread|스레드/ });
  await panelB.getByLabel(/Reply to thread|스레드에 답글 달기/).fill("first panel reply");
  await panelB.getByRole("button", { name: /Send thread reply|답글 전송/ }).click();
  await expect(panelB.getByTestId("thread-reply")).toContainText("first panel reply");
  await expect(pageB.getByTestId("message-row").filter({ hasText: "first panel reply" })).toHaveCount(0);

  await rootRowA.first().getByRole("button", { name: "Open thread" }).click();
  const panelA = pageA.getByRole("dialog", { name: /Thread|스레드/ });
  await expect(panelA).toContainText("first panel reply");

  await panelB.getByRole("button", { name: /Edit thread reply|답글 수정/ }).click();
  await panelB.getByLabel("Edit thread reply content").fill("edited panel reply");
  await panelB.getByLabel("Edit thread reply content").press("Enter");
  await expect(panelA).toContainText("edited panel reply");

  await pageA.reload();
  // After reload the dashboard re-runs space auto-selection; contextA has two spaces so
  // we must re-select Thread Space explicitly to ensure the right message list loads.
  const reloadedCombo = pageA.getByRole("combobox", { name: "Select space" });
  await expect(reloadedCombo).toBeVisible({ timeout: 15_000 });
  await reloadedCombo.selectOption({ value: space.id });
  const reconnectedRoot = pageA.getByTestId("message-row").filter({ hasText: "durable thread root" });
  await expect(reconnectedRoot.first()).toBeVisible({ timeout: 15_000 });
  await reconnectedRoot.first().getByRole("button", { name: "Open thread" }).click();
  await expect(pageA.getByRole("dialog", { name: /Thread|스레드/ })).toContainText("edited panel reply");

  await panelB.getByRole("button", { name: /Delete thread reply|답글 삭제/ }).click();
  await expect(pageA.getByRole("dialog", { name: /Thread|스레드/ })).toContainText("[deleted message]");

  await contextA.close();
  await contextB.close();
  await contextC.close();
});
