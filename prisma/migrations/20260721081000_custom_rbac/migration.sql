-- Additive RBAC migration. The legacy Member.role column is retained during cutover so
-- existing data remains readable and OWNER continues to be an immutable authority.
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Role_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    PRIMARY KEY ("roleId", "permission"),
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MembershipRole" (
    "memberId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    PRIMARY KEY ("memberId", "roleId"),
    CONSTRAINT "MembershipRole_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MembershipRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Role_spaceId_name_key" ON "Role"("spaceId", "name");
CREATE INDEX "Role_spaceId_idx" ON "Role"("spaceId");
CREATE INDEX "MembershipRole_roleId_idx" ON "MembershipRole"("roleId");

-- Preserve the authority of every historical ADMIN with a Space-scoped compatibility role.
INSERT INTO "Role" ("id", "spaceId", "name", "updatedAt")
SELECT lower(hex(randomblob(16))), "spaceId", 'Legacy Admin', CURRENT_TIMESTAMP
FROM "Member"
WHERE "role" = 'ADMIN'
GROUP BY "spaceId";

INSERT INTO "RolePermission" ("roleId", "permission")
SELECT r."id", p."permission"
FROM "Role" r
CROSS JOIN (
    SELECT 'MANAGE_CHANNELS' AS "permission"
    UNION ALL SELECT 'KICK_MEMBERS'
    UNION ALL SELECT 'DELETE_OTHERS_MESSAGES'
    UNION ALL SELECT 'CONTROL_VOICE'
    UNION ALL SELECT 'MENTION_EVERYONE'
    UNION ALL SELECT 'MANAGE_PINS'
    UNION ALL SELECT 'MANAGE_INVITES'
    UNION ALL SELECT 'MANAGE_EXPRESSIONS'
) p
WHERE r."name" = 'Legacy Admin';

INSERT INTO "MembershipRole" ("memberId", "roleId")
SELECT m."id", r."id"
FROM "Member" m
JOIN "Role" r ON r."spaceId" = m."spaceId" AND r."name" = 'Legacy Admin'
WHERE m."role" = 'ADMIN';
