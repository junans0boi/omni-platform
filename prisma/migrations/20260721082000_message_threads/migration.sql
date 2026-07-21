-- Additive only: existing messages and their identifiers remain untouched.
ALTER TABLE "Message" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Message" ADD COLUMN "replyToId" TEXT;
ALTER TABLE "Message" ADD COLUMN "threadRootId" TEXT;

CREATE INDEX "Message_channelId_threadRootId_createdAt_id_idx"
  ON "Message"("channelId", "threadRootId", "createdAt", "id");
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");
