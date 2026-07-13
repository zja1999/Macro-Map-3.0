import { cookies } from "next/headers";
import { safeRedirectPath } from "./safeRedirect";

export const POST_AUTH_NEXT_COOKIE = "mm_post_auth_next";

export async function rememberPostAuthNext(value: unknown) {
  const path = safeRedirectPath(value, "");
  if (!path) return;
  const jar = await cookies();
  jar.set(POST_AUTH_NEXT_COOKIE, path, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 20 * 60,
    path: "/",
  });
}

export async function consumePostAuthNext(fallback = "/") {
  const jar = await cookies();
  const path = safeRedirectPath(jar.get(POST_AUTH_NEXT_COOKIE)?.value, fallback);
  jar.delete(POST_AUTH_NEXT_COOKIE);
  return path;
}
