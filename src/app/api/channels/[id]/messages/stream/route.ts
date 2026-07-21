import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageBroker } from "@/lib/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: channelId } = await params;

  try {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return new Response("Channel not found", { status: 404 });
    }

    const isMember = await prisma.member.findUnique({
      where: {
        spaceId_profileId: {
          spaceId: channel.spaceId,
          profileId: user.id,
        },
      },
    });

    if (!isMember) {
      return new Response("Forbidden", { status: 403 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection confirmation
        controller.enqueue(encoder.encode(": connected\n\n"));

        const handleMessage = (msg: unknown) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(msg)}\n\n`)
            );
          } catch {
            cleanup();
          }
        };

        // Keep-alive ping every 20 seconds
        const pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            cleanup();
          }
        }, 20000);

        messageBroker.on(`message:${channelId}`, handleMessage);

        function cleanup() {
          clearInterval(pingInterval);
          messageBroker.off(`message:${channelId}`, handleMessage);
          try {
            controller.close();
          } catch {}
        }

        req.signal.addEventListener("abort", cleanup);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-store, no-transform",
        "Connection": "keep-alive",
        // Disable buffering in Nginx / proxies
        "X-Accel-Buffering": "no",
        // Prevent Next.js from gzip-compressing the stream
        "Content-Encoding": "none",
      },
    });
  } catch (error: unknown) {
    return new Response(error instanceof Error ? error.message : "Unknown error", { status: 500 });
  }
}
