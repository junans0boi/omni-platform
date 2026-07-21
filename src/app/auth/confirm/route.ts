import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAuthClient } from "@/lib/supabase-auth";

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const code = req.nextUrl.searchParams.get("code");
  const type = req.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const requestedNext = req.nextUrl.searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/reset-password";

  const supabase = await createSupabaseAuthClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, req.url));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, req.url));
  }

  return NextResponse.redirect(new URL("/login?recovery=invalid", req.url));
}
