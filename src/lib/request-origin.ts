import { NextRequest } from "next/server";

export function getPublicOrigin(req: Request | NextRequest): string {
  // 1. Explicit environment variable if configured
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  // 2. Extract from request headers (Reverse Proxy support: Caddy, Nginx, Cloudflare)
  const headers = req.headers;
  const forwardedHost = headers.get("x-forwarded-host");
  const host = forwardedHost || headers.get("host");

  if (host) {
    const forwardedProto = headers.get("x-forwarded-proto");
    // Default to https if hosted on custom domain or non-localhost, otherwise protocol
    const proto = forwardedProto
      ? forwardedProto.split(",")[0].trim()
      : host.includes("localhost") || host.includes("127.0.0.1")
      ? "http"
      : "https";
    return `${proto}://${host}`;
  }

  // 3. Fallback to req.url origin
  const url = new URL(req.url);
  return url.origin;
}
