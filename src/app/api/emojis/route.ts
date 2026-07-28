import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

const defaultCustomEmojis = [
  { id: "e1", code: ":omni:", name: "Omni Logo", url: "/emoji/omni.png" },
  { id: "e2", code: ":fire_heart:", name: "Fire Heart", url: "/emoji/fire_heart.png" },
  { id: "e3", code: ":party_blob:", name: "Party Blob", url: "/emoji/party_blob.png" },
];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(defaultCustomEmojis);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { code, url, name } = body;

    if (!code || !url) {
      return NextResponse.json({ error: "code and url are required" }, { status: 400 });
    }

    const newEmoji = {
      id: `e_${Date.now()}`,
      code: code.startsWith(":") ? code : `:${code}:`,
      name: name || code,
      url,
    };

    return NextResponse.json(newEmoji, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create emoji" }, { status: 500 });
  }
}
