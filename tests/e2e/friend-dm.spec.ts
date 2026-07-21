import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function createUser(context: BrowserContext, suffix: string) {
  const response = await context.request.post("/api/auth/signup", { data: {
    username: `dm_${suffix}`,
    display_name: `DM ${suffix}`,
    email: `dm-${suffix}@example.com`,
    password: "direct-message-password",
  }});
  expect(response.status()).toBe(200);
}

async function openHome(page: Page) {
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
}

test("two friends can start a DM while a third Profile cannot read or send", async ({ browser }, testInfo) => {
  const suffix = `${Date.now()}_${testInfo.retry}`;
  const contextA = await browser.newContext({ baseURL: "http://localhost:3100" });
  const contextB = await browser.newContext({ baseURL: "http://localhost:3100" });
  const contextC = await browser.newContext({ baseURL: "http://localhost:3100" });
  await createUser(contextA, `a_${suffix}`);
  await createUser(contextB, `b_${suffix}`);
  await createUser(contextC, `c_${suffix}`);
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await openHome(pageA);
  await pageA.getByLabel("Friend username").fill(`dm_b_${suffix}`);
  await pageA.getByRole("button", { name: "Send friend request" }).click();

  await openHome(pageB);
  await pageB.getByRole("button", { name: `Accept dm_a_${suffix}` }).click();
  const conversationButton = pageB.getByRole("button", { name: `DM a_${suffix}` });
  await expect(conversationButton).toBeVisible();
  await conversationButton.click();
  await pageB.getByRole("textbox", { name: "Direct message" }).fill("private hello");
  await pageB.getByRole("button", { name: "Send direct message" }).click();
  await expect(pageB.getByLabel("Direct message history")).toContainText("private hello");

  const conversations = await contextB.request.get("/api/dms");
  const [{ id: conversationId }] = await conversations.json() as Array<{ id: string }>;
  expect((await contextC.request.get(`/api/dms/${conversationId}/messages`)).status()).toBe(403);
  expect((await contextC.request.post(`/api/dms/${conversationId}/messages`, { data: { content: "intrusion" } })).status()).toBe(403);

  await contextA.close();
  await contextB.close();
  await contextC.close();
});
