import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "session_token";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(profileId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1_000);

  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      profileId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DURATION_SECONDS,
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  try {
    if (token) {
      await prisma.session.deleteMany({
        where: { tokenHash: hashSessionToken(token) },
      });
    }
  } finally {
    cookieStore.delete(SESSION_COOKIE_NAME);
    cookieStore.delete("session_user_id");
  }
}
