import { NextResponse } from "next/server";
import { googleAuthorizationUrl, getGoogleConfig, GOOGLE_STATE_COOKIE, newGoogleState } from "@/lib/googleAuth";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { POST_AUTH_NEXT_COOKIE } from "@/lib/postAuthNext";

export async function GET(request: Request) {
  const config = getGoogleConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", request.url));
  }

  const state = newGoogleState();
  const response = NextResponse.redirect(googleAuthorizationUrl(config, state));
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  });
  const next = safeRedirectPath(new URL(request.url).searchParams.get("next"), "");
  if (next) response.cookies.set(POST_AUTH_NEXT_COOKIE, next, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 20 * 60, path: "/",
  });
  return response;
}
