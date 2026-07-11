import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Logged-out visitors can browse public content; everything else needs an account.
// This is the single gate — no more guest accounts. Interactions on public pages
// (save, vote, comment, log) still bounce to /login via their server actions.
const PUBLIC_PREFIXES = ["/recipes", "/workouts", "/restaurants", "/meal-prep", "/discover"];

// …but these authenticated actions live under a public prefix, so carve them back out.
const PROTECTED_EXCEPTIONS = ["/recipes/new", "/workouts/new", "/workouts/log", "/meal-prep/new"];

function isPublicPath(pathname: string): boolean {
  const matches = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  if (PROTECTED_EXCEPTIONS.some(matches)) return false;
  return PUBLIC_PREFIXES.some(matches);
}

export function middleware(req: NextRequest) {
  if (isPublicPath(req.nextUrl.pathname)) return NextResponse.next();
  // presence check only — getCurrentUser() still validates the session on the page
  if (req.cookies.has("mm_session")) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // run on app pages; skip api, Next internals, static files, and the auth pages themselves
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|register|forgot-password|reset-password|verify-email|.*\\.).*)"],
};
