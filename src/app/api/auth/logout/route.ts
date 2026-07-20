import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete("session_user_id");
  return NextResponse.json({ success: true });
}
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete("session_user_id");
  return NextResponse.json({ success: true });
}
