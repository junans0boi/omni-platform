import { NextRequest, NextResponse } from "next/server";
import { getAuthBackend } from "@/lib/auth-backend";
import { createSupabaseAuthClient } from "@/lib/supabase-auth";

export async function POST(req: NextRequest) {
  if (getAuthBackend() !== "supabase") {
    return NextResponse.json({ error: "Account claim is not enabled" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Use a valid email address" }, { status: 400 });
  }

  const supabase = await createSupabaseAuthClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${req.nextUrl.origin}/auth/confirm?next=/reset-password`,
  });

  // A generic response prevents account discovery. Supabase owns delivery and rate limits.
  return NextResponse.json({ accepted: true }, { status: 202 });
}
