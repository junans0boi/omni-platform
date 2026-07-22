-- DropIndex
DROP INDEX "Role_spaceId_position_id_idx";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    "replyToId" TEXT,
    "threadRootId" TEXT,
    CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_threadRootId_fkey" FOREIGN KEY ("threadRootId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("channelId", "content", "createdAt", "deletedAt", "editedAt", "id", "profileId", "replyToId", "threadRootId") SELECT "channelId", "content", "createdAt", "deletedAt", "editedAt", "id", "profileId", "replyToId", "threadRootId" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_channelId_threadRootId_createdAt_id_idx" ON "Message"("channelId", "threadRootId", "createdAt", "id");
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");
CREATE TABLE "new_UserPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "pcNotification" BOOLEAN NOT NULL DEFAULT true,
    "friendAnniversary" BOOLEAN NOT NULL DEFAULT true,
    "friendOnline" BOOLEAN NOT NULL DEFAULT true,
    "friendProfileUpdate" BOOLEAN NOT NULL DEFAULT true,
    "reactionNotification" TEXT NOT NULL DEFAULT 'all',
    "newMessageSound" BOOLEAN NOT NULL DEFAULT true,
    "activeChannelSound" BOOLEAN NOT NULL DEFAULT true,
    "ringtoneSound" BOOLEAN NOT NULL DEFAULT true,
    "disableAllSounds" BOOLEAN NOT NULL DEFAULT false,
    "micDeviceId" TEXT,
    "speakerDeviceId" TEXT,
    "cameraDeviceId" TEXT,
    "micVolume" INTEGER NOT NULL DEFAULT 80,
    "speakerVolume" INTEGER NOT NULL DEFAULT 85,
    "inputProfile" TEXT NOT NULL DEFAULT 'isolation',
    "pushToTalk" BOOLEAN NOT NULL DEFAULT false,
    "alwaysPreviewVideo" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT NOT NULL DEFAULT 'ko',
    "timeFormat" TEXT NOT NULL DEFAULT 'auto',
    "themeName" TEXT NOT NULL DEFAULT 'default',
    "themeMode" TEXT NOT NULL DEFAULT 'dark',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPreference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserPreference" ("activeChannelSound", "alwaysPreviewVideo", "cameraDeviceId", "createdAt", "disableAllSounds", "friendAnniversary", "friendOnline", "friendProfileUpdate", "id", "inputProfile", "locale", "micDeviceId", "micVolume", "newMessageSound", "pcNotification", "profileId", "pushToTalk", "reactionNotification", "ringtoneSound", "speakerDeviceId", "speakerVolume", "timeFormat", "updatedAt") SELECT "activeChannelSound", "alwaysPreviewVideo", "cameraDeviceId", "createdAt", "disableAllSounds", "friendAnniversary", "friendOnline", "friendProfileUpdate", "id", "inputProfile", "locale", "micDeviceId", "micVolume", "newMessageSound", "pcNotification", "profileId", "pushToTalk", "reactionNotification", "ringtoneSound", "speakerDeviceId", "speakerVolume", "timeFormat", "updatedAt" FROM "UserPreference";
DROP TABLE "UserPreference";
ALTER TABLE "new_UserPreference" RENAME TO "UserPreference";
CREATE UNIQUE INDEX "UserPreference_profileId_key" ON "UserPreference"("profileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
