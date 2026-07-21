PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "password" TEXT,
    "passwordHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_Profile" (
    "id", "username", "displayName", "avatarUrl", "password", "createdAt", "updatedAt"
)
SELECT
    "id", "username", "displayName", "avatarUrl", "password", "createdAt", "updatedAt"
FROM "Profile";

DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";

CREATE UNIQUE INDEX "Profile_username_key" ON "Profile"("username");
CREATE UNIQUE INDEX "Profile_email_key" ON "Profile"("email");

CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_profileId_idx" ON "Session"("profileId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
