import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error("GOOGLE_CLIENT_ID is not configured");
      return NextResponse.redirect(new URL("/login?error=google_auth_not_configured", req.url));
    }

    const requestUrl = new URL(req.url);
    const redirectUri = `${requestUrl.origin}/api/auth/google/callback`;

    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email profile");
    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "select_account");

    return NextResponse.redirect(googleAuthUrl.toString());
  } catch (error) {
    console.error("Google Auth error:", error);
    return NextResponse.redirect(new URL("/login?error=google_auth_failed", req.url));
  }
}

