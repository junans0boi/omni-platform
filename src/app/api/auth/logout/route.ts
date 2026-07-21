import { NextResponse } from "next/server";
import { deleteCurrentSession } from "@/lib/session";

export async function POST() {
  await deleteCurrentSession();
  return NextResponse.json({ success: true });
}
