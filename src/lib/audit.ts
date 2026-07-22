import { prisma } from "@/lib/prisma";

export interface LogAuditParams {
  spaceId: string;
  actorId: string;
  actorName: string;
  action:
    | "ROLE_CREATE"
    | "ROLE_UPDATE"
    | "ROLE_DELETE"
    | "MEMBER_KICK"
    | "MEMBER_ROLE_UPDATE"
    | "CHANNEL_CREATE"
    | "CHANNEL_DELETE"
    | "SPACE_UPDATE"
    | "MANAGE_MESSAGES"
    | "MESSAGE_DELETE";
  targetName?: string;
  details?: string;
}

export async function createAuditLog({
  spaceId,
  actorId,
  actorName,
  action,
  targetName,
  details,
}: LogAuditParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        spaceId,
        actorId,
        actorName,
        action,
        targetName,
        details,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    return null;
  }
}
