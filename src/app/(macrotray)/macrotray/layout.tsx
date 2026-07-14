import { redirect } from "next/navigation";
import { getCurrentUser, getSessionUser } from "@/lib/auth";
import { MacroTrayNav } from "@/components/MacroTrayNav";

export const metadata = { title: "MacroTray" };

export default async function MacroTrayLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getSessionUser();
  if (sessionUser && !sessionUser.hasPassword) redirect("/account-setup");
  const user = await getCurrentUser();
  return <div className="min-h-dvh bg-bg"><MacroTrayNav connected={!!user?.profile.onboardedAt} /><main className="mx-auto max-w-xl p-3">{children}</main></div>;
}
