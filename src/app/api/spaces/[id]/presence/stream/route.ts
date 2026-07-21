import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  connectPresence,
  messageBroker,
  presenceEventName,
  type PresenceSnapshot,
} from "@/lib/events";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id: spaceId } = await params;
  const member = await prisma.member.findUnique({
    where: {
      spaceId_profileId: { spaceId, profileId: user.id },
    },
  });

  if (!member) return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const eventName = presenceEventName(spaceId);

      const sendSnapshot = (snapshot: PresenceSnapshot) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`)
          );
        } catch {
          cleanup();
        }
      };

      messageBroker.on(eventName, sendSnapshot);
      const disconnectPresence = connectPresence(spaceId, {
        user_id: user.id,
        username: user.username,
        display_name: user.displayName || user.username,
        avatar_url: user.avatarUrl,
        online_at: new Date().toISOString(),
      });

      const pingInterval = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup();
        }
      }, 20_000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(pingInterval);
        request.signal.removeEventListener("abort", cleanup);
        messageBroker.off(eventName, sendSnapshot);
        disconnectPresence();
        try {
          controller.close();
        } catch {
          // The consumer may already have closed the stream.
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
      if (request.signal.aborted) cleanup();
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "none",
    },
  });
}
