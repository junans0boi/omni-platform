import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("session_user_id")?.value;
  if (!userId) return null;

  try {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
    });
    return profile;
  } catch (e) {
    return null;
  }
}
