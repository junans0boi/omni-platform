import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { TrackSource } from "@livekit/protocol";
import { RoomServiceClient } from "livekit-server-sdk";

const baseURL = "http://127.0.0.1:3200";
const livekitHttpUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL
  ?.replace(/^wss:/, "https:")
  .replace(/^ws:/, "http:");
const roomService = livekitHttpUrl && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET
  ? new RoomServiceClient(
      livekitHttpUrl,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
    )
  : null;

async function participant(room: string, identity: string) {
  const participants = await roomService?.listParticipants(room);
  return participants?.find((candidate) => candidate.identity === identity);
}

async function signup(context: BrowserContext, username: string, displayName: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await context.request.post(`${baseURL}/api/auth/signup`, {
      data: {
        username,
        display_name: displayName,
        email: `${username}@example.com`,
        password: "livekit-e2e-password",
      },
    });
    if (response.status() === 200) {
      return (await response.json()) as { user: { id: string } };
    }
    if (response.status() !== 500 || attempt === 1) expect(response.status()).toBe(200);
  }
  throw new Error("Signup retry exhausted");
}

async function joinChannel(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.getByText("Voice Connected", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
}

test("two users exchange media and Stage audience remains subscribe-only", async ({ browser }) => {
  test.skip(process.env.RUN_LIVEKIT_E2E !== "1", "Run through npm run test:livekit");

  const suffix = Date.now().toString(36);
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const outsiderContext = await browser.newContext();

  try {
    const owner = await signup(ownerContext, `lk_owner_${suffix}`, "LiveKit Owner");
    const member = await signup(memberContext, `lk_member_${suffix}`, "LiveKit Member");
    await signup(outsiderContext, `lk_outsider_${suffix}`, "LiveKit Outsider");

    const spaceResponse = await ownerContext.request.post(`${baseURL}/api/spaces`, {
      data: { name: `LiveKit E2E ${suffix}` },
    });
    expect(spaceResponse.status()).toBe(200);
    const space = (await spaceResponse.json()) as { id: string; inviteCode: string };

    const detailsResponse = await ownerContext.request.get(`${baseURL}/api/spaces/${space.id}`);
    expect(detailsResponse.status()).toBe(200);
    const details = (await detailsResponse.json()) as {
      categories: Array<{ id: string }>;
      channels: Array<{ id: string; name: string; type: string }>;
    };
    const voice = details.channels.find((channel) => channel.type === "VOICE");
    expect(voice).toBeDefined();

    const stageResponse = await ownerContext.request.post(
      `${baseURL}/api/spaces/${space.id}/channels`,
      { data: { name: "발표장", type: "STAGE", categoryId: details.categories[0]?.id } },
    );
    expect(stageResponse.status()).toBe(200);
    const stage = (await stageResponse.json()) as { id: string };

    const joinResponse = await memberContext.request.put(`${baseURL}/api/spaces`, {
      data: { invite_code: space.inviteCode },
    });
    expect(joinResponse.status()).toBe(200);

    const ownerVoiceGrant = await ownerContext.request.get(
      `${baseURL}/api/livekit/token?room=${voice?.id}`,
    );
    const memberVoiceGrant = await memberContext.request.get(
      `${baseURL}/api/livekit/token?room=${voice?.id}`,
    );
    const ownerStageGrant = await ownerContext.request.get(
      `${baseURL}/api/livekit/token?room=${stage.id}`,
    );
    const memberStageGrant = await memberContext.request.get(
      `${baseURL}/api/livekit/token?room=${stage.id}`,
    );
    const outsiderGrant = await outsiderContext.request.get(
      `${baseURL}/api/livekit/token?room=${stage.id}`,
    );

    expect((await ownerVoiceGrant.json()).canPublish).toBe(true);
    expect((await memberVoiceGrant.json()).canPublish).toBe(true);
    expect((await ownerStageGrant.json()).canPublish).toBe(true);
    expect((await memberStageGrant.json()).canPublish).toBe(false);
    expect(outsiderGrant.status()).toBe(403);

    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();
    await Promise.all([ownerPage.goto("/dashboard"), memberPage.goto("/dashboard")]);

    await Promise.all([joinChannel(ownerPage, "로비"), joinChannel(memberPage, "로비")]);
    const ownerRemote = memberPage.locator(`[data-livekit-participant="${owner.user.id}"]`);
    await expect(ownerPage.locator(`[data-livekit-participant="${member.user.id}"]`)).toHaveAttribute(
      "data-livekit-audio-subscribed",
      "true",
    );
    await expect(ownerRemote).toHaveAttribute("data-livekit-audio-subscribed", "true");
    await expect.poll(async () =>
      (await participant(voice!.id, owner.user.id))?.tracks.some(
        (track) => track.source === TrackSource.MICROPHONE && !track.muted,
      ),
    ).toBe(true);

    await ownerPage.getByTitle("Camera On").click();
    await expect(ownerRemote).toHaveAttribute("data-livekit-video-source", "camera", {
      timeout: 20_000,
    });
    await ownerPage.getByTitle("Camera Off").click();
    await expect(ownerRemote).toHaveAttribute("data-livekit-video-source", "none", {
      timeout: 20_000,
    });

    const shareButton = ownerPage.getByTitle("Share Screen");
    await shareButton.click();
    await expect(shareButton).toHaveAttribute("aria-pressed", "true");
    await expect(ownerRemote).toHaveAttribute("data-livekit-video-source", "screen_share", {
      timeout: 20_000,
    });

    await Promise.all([
      ownerPage.getByRole("button", { name: "Leave", exact: true }).click(),
      memberPage.getByRole("button", { name: "Leave", exact: true }).click(),
    ]);
    await Promise.all([joinChannel(ownerPage, "발표장"), joinChannel(memberPage, "발표장")]);

    await expect(memberPage.getByTitle("스테이지 청취자는 마이크를 사용할 수 없습니다")).toBeDisabled();
    await expect(memberPage.getByTitle("스테이지 청취자는 카메라를 사용할 수 없습니다")).toBeDisabled();
    await expect(memberPage.getByTitle("스테이지 청취자는 화면을 공유할 수 없습니다")).toBeDisabled();
    const stageOwner = memberPage.locator(`[data-livekit-participant="${owner.user.id}"]`);
    await expect(stageOwner).toHaveAttribute("data-livekit-audio-subscribed", "true");
    await expect.poll(async () => ({
      owner: (await participant(stage.id, owner.user.id))?.permission?.canPublish,
      member: (await participant(stage.id, member.user.id))?.permission?.canPublish,
    })).toEqual({ owner: true, member: false });

    await ownerPage.getByTitle("Camera On").click();
    await expect(stageOwner).toHaveAttribute("data-livekit-video-source", "camera", {
      timeout: 20_000,
    });
    await ownerPage.getByTitle("Share Screen").click();
    await expect(stageOwner).toHaveAttribute("data-livekit-video-source", "screen_share", {
      timeout: 20_000,
    });

  } finally {
    await Promise.all([
      ownerContext.close(),
      memberContext.close(),
      outsiderContext.close(),
    ]);
  }
});
