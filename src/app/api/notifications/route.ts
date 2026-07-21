import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export interface NotificationItem {
  id: string;
  type: "MENTION" | "DM" | "FRIEND_REQUEST" | "SYSTEM";
  title: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  targetSpaceId?: string;
  targetChannelId?: string;
  targetConversationId?: string;
  sender?: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

// In-memory notification state bus
const userNotificationsStore = new Map<string, NotificationItem[]>();

function getOrCreateUserNotifications(userId: string): NotificationItem[] {
  if (!userNotificationsStore.has(userId)) {
    const initial: NotificationItem[] = [
      {
        id: "notif-1",
        type: "MENTION",
        title: "@here 채널 멘션",
        content: "Omni-Platform 새로운 기능 업데이트 안내 및 점검 공지입니다.",
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        isRead: false,
      },
      {
        id: "notif-2",
        type: "DM",
        title: "새 1:1 다이렉트 메시지",
        content: "안녕하세요! 지난번 공유해주신 기능건 잘 테스트해보았습니다.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        isRead: false,
      },
      {
        id: "notif-3",
        type: "FRIEND_REQUEST",
        title: "친구 요청 도착",
        content: "새로운 사용자가 친구 요청을 보냈습니다.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        isRead: true,
      },
    ];
    userNotificationsStore.set(userId, initial);
  }
  return userNotificationsStore.get(userId)!;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = getOrCreateUserNotifications(user.id);
  return NextResponse.json(notifications);
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, markAllRead } = body as { id?: string; markAllRead?: boolean };

  const notifications = getOrCreateUserNotifications(user.id);

  if (markAllRead) {
    notifications.forEach((n) => (n.isRead = true));
  } else if (id) {
    const item = notifications.find((n) => n.id === id);
    if (item) item.isRead = true;
  }

  return NextResponse.json({ success: true, notifications });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  let notifications = getOrCreateUserNotifications(user.id);
  if (id) {
    notifications = notifications.filter((n) => n.id !== id);
    userNotificationsStore.set(user.id, notifications);
  }

  return NextResponse.json({ success: true, notifications });
}
