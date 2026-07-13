import { NextResponse } from "next/server";
import { googleAuthorizationUrl, getGoogleConfig, GOOGLE_STATE_COOKIE, newGoogleState } from "@/lib/googleAuth";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { POST_AUTH_NEXT_COOKIE } from "@/lib/postAuthNext";

export async function GET(request: Request) {
  const next = safeRedirectPath(new URL(request.url).searchParams.get("next"), "");
  const config = getGoogleConfig();
  if (!config) {
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "google_not_configured");
    if (next) login.searchParams.set("next", next);
    return NextResponse.redirect(login);
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
  if (next) response.cookies.set(POST_AUTH_NEXT_COOKIE, next, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 20 * 60, path: "/",
  });
  return response;
}
