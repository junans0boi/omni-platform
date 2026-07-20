import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageBroker } from "@/lib/events";

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

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    const pingInterval = setInterval(async () => {
      try {
        await writer.write(encoder.encode(":\n\n"));
      } catch {
        cleanup();
      }
    }, 15000);

    const handleMessage = async (msg: any) => {
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
      } catch {
        cleanup();
      }
    };

    messageBroker.on(`message:${channelId}`, handleMessage);

    const cleanup = () => {
      clearInterval(pingInterval);
      messageBroker.off(`message:${channelId}`, handleMessage);
      try {
        writer.close();
      } catch {}
    };

    req.signal.addEventListener("abort", cleanup);

    return new Response(responseStream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
}
