import { prisma } from "./prisma";
import { resolveDisplayRole, type DisplayRole } from "./role-appearance";

export async function getDisplayRoles(
  spaceId: string,
  profileIds: readonly string[],
): Promise<Map<string, DisplayRole>> {
  const memberships = await prisma.member.findMany({
    where: { spaceId, profileId: { in: [...new Set(profileIds)] } },
    select: {
      profileId: true,
      membershipRoles: {
        select: {
          role: {
            select: { id: true, name: true, position: true, colorHex: true, badgeKey: true },
          },
        },
      },
    },
  });
  return new Map(
    memberships.map((membership) => [
      membership.profileId,
      resolveDisplayRole(membership.membershipRoles.map(({ role }) => role)),
    ]),
  );
}
