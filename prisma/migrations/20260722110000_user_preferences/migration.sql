-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "phone" TEXT;

-- CreateTable
CREATE TABLE "UserPreference" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPreference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_profileId_key" ON "UserPreference"("profileId");
