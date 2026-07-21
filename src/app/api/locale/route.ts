import { NextResponse } from "next/server";
import { isLocale, LOCALE_COOKIE } from "@/i18n/locale";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const locale = typeof body === "object" && body !== null && "locale" in body ? body.locale : null;
  if (!isLocale(locale)) {
    return NextResponse.json({ code: "INVALID_LOCALE" }, { status: 400 });
  }

  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}
