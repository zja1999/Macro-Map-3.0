import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { MacroTrayApproval } from "@/components/MacroTrayApproval";
import { btnPrimary, btnGhost } from "@/components/ui";

export const metadata = { title: "Connect MacroTray" };

export default async function MacroTrayConnectPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = (await searchParams).code ?? "";
  const user = await getCurrentUser();
  const next = safeRedirectPath(`/macrotray-connect?code=${encodeURIComponent(code)}`);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 text-2xl font-black">Macro<span className="text-accent">verse</span></div>
      {user?.profile.onboardedAt ? <MacroTrayApproval code={code} /> : user ? (
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-edge bg-card p-6 text-center">
          <h1 className="text-lg font-bold">Finish account setup</h1>
          <p className="text-sm text-ink-dim">Complete your MacroVerse profile before connecting the Windows widget.</p>
          <Link href={`/onboarding?next=${encodeURIComponent(next)}`} className={`${btnPrimary} w-full`}>Continue setup</Link>
        </div>
      ) : (
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-edge bg-card p-6 text-center">
          <h1 className="text-lg font-bold">Sign in to connect MacroTray</h1>
          <p className="text-sm text-ink-dim">Use your normal MacroVerse account, then approve the Windows widget.</p>
          <Link href={`/login?next=${encodeURIComponent(next)}`} className={`${btnPrimary} w-full`}>Sign in</Link>
          <Link href={`/register?next=${encodeURIComponent(next)}`} className={`${btnGhost} w-full`}>Create account</Link>
        </div>
      )}
    </main>
  );
}
