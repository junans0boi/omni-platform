-- Add the Home friendship and one-to-one direct-message domain without rewriting
-- any existing table or row.
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileAId" TEXT NOT NULL,
    "profileBId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "blockedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Friendship_profileAId_fkey" FOREIGN KEY ("profileAId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Friendship_profileBId_fkey" FOREIGN KEY ("profileBId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Friendship_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Friendship_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "Profile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Friendship_canonical_pair" CHECK ("profileAId" < "profileBId"),
    CONSTRAINT "Friendship_status" CHECK ("status" IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REMOVED', 'BLOCKED')),
    CONSTRAINT "Friendship_requester_in_pair" CHECK ("requestedById" IN ("profileAId", "profileBId")),
    CONSTRAINT "Friendship_blocker_in_pair" CHECK ("blockedById" IS NULL OR "blockedById" IN ("profileAId", "profileBId"))
);
CREATE UNIQUE INDEX "Friendship_profileAId_profileBId_key" ON "Friendship"("profileAId", "profileBId");
CREATE INDEX "Friendship_profileAId_status_idx" ON "Friendship"("profileAId", "status");
CREATE INDEX "Friendship_profileBId_status_idx" ON "Friendship"("profileBId", "status");

CREATE TABLE "DirectConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "friendshipId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectConversation_friendshipId_fkey" FOREIGN KEY ("friendshipId") REFERENCES "Friendship" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DirectConversation_friendshipId_key" ON "DirectConversation"("friendshipId");

CREATE TABLE "DirectParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DirectParticipant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DirectParticipant_conversationId_profileId_key" ON "DirectParticipant"("conversationId", "profileId");
CREATE INDEX "DirectParticipant_profileId_conversationId_idx" ON "DirectParticipant"("profileId", "conversationId");

CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" DATETIME,
    CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DirectMessage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DirectMessage_content_not_blank" CHECK (length(trim("content")) > 0)
);
CREATE INDEX "DirectMessage_conversationId_createdAt_id_idx" ON "DirectMessage"("conversationId", "createdAt", "id");
CREATE INDEX "DirectMessage_profileId_idx" ON "DirectMessage"("profileId");
