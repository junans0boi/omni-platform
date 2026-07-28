import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { getPublicOrigin } from "@/lib/request-origin";

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function GET(req: NextRequest) {
  const origin = getPublicOrigin(req);
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");

  if (error || !code) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(new URL("/login?error=google_auth_cancelled", origin));
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing");
      return NextResponse.redirect(new URL("/login?error=google_auth_not_configured", origin));
    }

    const redirectUri = `${origin}/api/auth/google/callback`;

    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const tokenErr = await tokenRes.text();
      console.error("Failed to exchange Google token:", tokenErr);
      return NextResponse.redirect(new URL("/login?error=google_token_failed", origin));
    }

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

    // 2. Fetch user profile info from Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      console.error("Failed to fetch Google user info");
      return NextResponse.redirect(new URL("/login?error=google_userinfo_failed", origin));
    }

    const googleUser = (await userRes.json()) as GoogleUserInfo;

    if (!googleUser.email) {
      return NextResponse.redirect(new URL("/login?error=google_email_missing", origin));
    }

    const email = googleUser.email.toLowerCase().trim();

    // 3. Find or create profile in Prisma DB
    let profile = await prisma.profile.findFirst({
      where: {
        OR: [{ email }, { username: email.split("@")[0] }],
      },
    });

    if (!profile) {
      // Base username generation
      let baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
      if (!baseUsername) baseUsername = "user";

      let uniqueUsername = baseUsername;
      let counter = 1;

      while (await prisma.profile.findUnique({ where: { username: uniqueUsername } })) {
        uniqueUsername = `${baseUsername}_${counter}`;
        counter++;
      }

      profile = await prisma.profile.create({
        data: {
          username: uniqueUsername,
          email,
          displayName: googleUser.name || uniqueUsername,
          avatarUrl: googleUser.picture || null,
        },
      });
    } else {
      // Existing profile found, update avatar or displayName if empty
      const updateData: { avatarUrl?: string; displayName?: string } = {};
      if (!profile.avatarUrl && googleUser.picture) {
        updateData.avatarUrl = googleUser.picture;
      }
      if (!profile.displayName && googleUser.name) {
        updateData.displayName = googleUser.name;
      }

      if (Object.keys(updateData).length > 0) {
        profile = await prisma.profile.update({
          where: { id: profile.id },
          data: updateData,
        });
      }
    }

    // 4. Create custom session cookie and redirect to dashboard
    await createSession(profile.id);

    return NextResponse.redirect(new URL("/dashboard", origin));
  } catch (err) {
    console.error("Unhandled error in Google callback:", err);
    return NextResponse.redirect(new URL("/login?error=unexpected", origin));
  }
}
