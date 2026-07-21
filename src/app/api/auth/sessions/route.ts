import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const currentTokenHash = currentToken ? hashSessionToken(currentToken) : null;

  const sessions = await prisma.session.findMany({
    where: { profileId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      tokenHash: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  const formatted = sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    isCurrent: s.tokenHash === currentTokenHash,
  }));

  return NextResponse.json({ sessions: formatted });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const currentTokenHash = currentToken ? hashSessionToken(currentToken) : null;

  if (currentTokenHash) {
    // Delete all sessions for this user EXCEPT current session
    await prisma.session.deleteMany({
      where: {
        profileId: user.id,
        tokenHash: { not: currentTokenHash },
      },
    });
  } else {
    // If no current token found, delete all sessions
    await prisma.session.deleteMany({
      where: { profileId: user.id },
    });
  }

  return NextResponse.json({ success: true });
}
