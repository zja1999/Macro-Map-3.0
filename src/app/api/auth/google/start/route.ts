import { NextResponse } from "next/server";
import { googleAuthorizationUrl, getGoogleConfig, GOOGLE_STATE_COOKIE, newGoogleState } from "@/lib/googleAuth";

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
  return response;
}
