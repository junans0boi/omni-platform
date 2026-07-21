import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export const safeProfileSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      select: {
        id: true,
        expiresAt: true,
        profile: { select: safeProfileSelect },
      },
    });

    if (!session) return null;
    if (session.expiresAt <= new Date()) {
      await prisma.session.delete({ where: { id: session.id } });
      return null;
    }

    return session.profile;
  } catch {
    return null;
  }
}
