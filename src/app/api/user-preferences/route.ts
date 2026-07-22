import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/user-preferences — Retrieve user preferences
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let preference = await prisma.userPreference.findUnique({
      where: { profileId: user.id },
    });

    if (!preference) {
      preference = await prisma.userPreference.create({
        data: { profileId: user.id },
      });
    }

    return NextResponse.json(preference);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH /api/user-preferences — Update user preferences
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Whitelist preference fields
    const {
      pcNotification,
      friendAnniversary,
      friendOnline,
      friendProfileUpdate,
      reactionNotification,
      newMessageSound,
      activeChannelSound,
      ringtoneSound,
      disableAllSounds,
      micDeviceId,
      speakerDeviceId,
      cameraDeviceId,
      micVolume,
      speakerVolume,
      inputProfile,
      pushToTalk,
      alwaysPreviewVideo,
      locale,
      timeFormat,
    } = body;

    const dataToUpdate: Record<string, unknown> = {};

    if (typeof pcNotification === "boolean") dataToUpdate.pcNotification = pcNotification;
    if (typeof friendAnniversary === "boolean") dataToUpdate.friendAnniversary = friendAnniversary;
    if (typeof friendOnline === "boolean") dataToUpdate.friendOnline = friendOnline;
    if (typeof friendProfileUpdate === "boolean") dataToUpdate.friendProfileUpdate = friendProfileUpdate;
    if (typeof reactionNotification === "string") dataToUpdate.reactionNotification = reactionNotification;

    if (typeof newMessageSound === "boolean") dataToUpdate.newMessageSound = newMessageSound;
    if (typeof activeChannelSound === "boolean") dataToUpdate.activeChannelSound = activeChannelSound;
    if (typeof ringtoneSound === "boolean") dataToUpdate.ringtoneSound = ringtoneSound;
    if (typeof disableAllSounds === "boolean") dataToUpdate.disableAllSounds = disableAllSounds;

    if (typeof micDeviceId === "string") dataToUpdate.micDeviceId = micDeviceId;
    if (typeof speakerDeviceId === "string") dataToUpdate.speakerDeviceId = speakerDeviceId;
    if (typeof cameraDeviceId === "string") dataToUpdate.cameraDeviceId = cameraDeviceId;
    if (typeof micVolume === "number") dataToUpdate.micVolume = micVolume;
    if (typeof speakerVolume === "number") dataToUpdate.speakerVolume = speakerVolume;
    if (typeof inputProfile === "string") dataToUpdate.inputProfile = inputProfile;
    if (typeof pushToTalk === "boolean") dataToUpdate.pushToTalk = pushToTalk;
    if (typeof alwaysPreviewVideo === "boolean") dataToUpdate.alwaysPreviewVideo = alwaysPreviewVideo;

    if (typeof locale === "string") dataToUpdate.locale = locale;
    if (typeof timeFormat === "string") dataToUpdate.timeFormat = timeFormat;

    const preference = await prisma.userPreference.upsert({
      where: { profileId: user.id },
      create: {
        profileId: user.id,
        ...dataToUpdate,
      },
      update: dataToUpdate,
    });

    return NextResponse.json(preference);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
