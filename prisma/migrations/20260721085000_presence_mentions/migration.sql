ALTER TABLE "Profile" ADD COLUMN "availability" TEXT NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "Profile" ADD COLUMN "customStatus" TEXT;

CREATE TABLE "Mention" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "targetProfileId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Mention_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Mention_targetProfileId_fkey" FOREIGN KEY ("targetProfileId") REFERENCES "Profile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "MentionRecipient" (
  "mentionId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  PRIMARY KEY ("mentionId", "profileId"),
  CONSTRAINT "MentionRecipient_mentionId_fkey" FOREIGN KEY ("mentionId") REFERENCES "Mention" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MentionRecipient_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Mention_messageId_idx" ON "Mention"("messageId");
CREATE INDEX "Mention_targetProfileId_idx" ON "Mention"("targetProfileId");
CREATE INDEX "MentionRecipient_profileId_mentionId_idx" ON "MentionRecipient"("profileId", "mentionId");
