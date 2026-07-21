import { prisma } from "./prisma";
import { canFromSnapshot, type AuthoritySnapshot, type Permission } from "./rbac-core";

export * from "./rbac-core";

export async function getAuthority(
  profileId: string,
  spaceId: string,
): Promise<AuthoritySnapshot | null> {
  const membership = await prisma.member.findUnique({
    where: { spaceId_profileId: { spaceId, profileId } },
    include: {
      membershipRoles: {
        select: {
          role: {
            select: {
              id: true,
              permissions: { select: { permission: true } },
            },
          },
        },
      },
    },
  });
  if (!membership) return null;

  return {
    membershipId: membership.id,
    membershipRole: membership.role,
    roleIds: membership.membershipRoles.map(({ role }) => role.id),
    permissions: [
      ...new Set(
        membership.membershipRoles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission),
        ),
      ),
    ],
  };
}

export async function can(profileId: string, spaceId: string, permission: Permission) {
  return canFromSnapshot(await getAuthority(profileId, spaceId), permission);
}
