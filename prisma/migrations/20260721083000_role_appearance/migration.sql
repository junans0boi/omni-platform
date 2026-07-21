ALTER TABLE "Role" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Role" ADD COLUMN "colorHex" TEXT;
ALTER TABLE "Role" ADD COLUMN "badgeKey" TEXT;

CREATE INDEX "Role_spaceId_position_id_idx" ON "Role"("spaceId", "position", "id");
