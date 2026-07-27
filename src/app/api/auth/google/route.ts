import { NextResponse } from "next/server";
import { requireSupabasePublicEnv } from "@/lib/auth-backend";

export async function GET(req: Request) {
  try {
    const { url } = requireSupabasePublicEnv();
    const requestUrl = new URL(req.url);
    const origin = requestUrl.origin;

    const googleAuthUrl = new URL(`${url}/auth/v1/authorize`);
    googleAuthUrl.searchParams.set("provider", "google");
    googleAuthUrl.searchParams.set("redirect_to", `${origin}/auth/callback`);

    return NextResponse.redirect(googleAuthUrl.toString());
  } catch (error) {
    console.error("Google Auth error:", error);
    return NextResponse.redirect(new URL("/login?error=google_auth_failed", req.url));
  }
}
