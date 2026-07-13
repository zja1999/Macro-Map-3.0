import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";

export const MACROTRAY_UA_TOKEN = "MacroTray/";

export async function isMacroTrayRequest() {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const referer = h.get("referer") ?? "";
  return ua.includes(MACROTRAY_UA_TOKEN) || /^https?:\/\/[^/]+\/macrotray(?:[/?#]|$)/i.test(referer);
}

export async function requireMacroTrayUser() {
  const user = await getCurrentUser();
  if (!user || !user.profile.onboardedAt) redirect("/macrotray");
  return user;
}
