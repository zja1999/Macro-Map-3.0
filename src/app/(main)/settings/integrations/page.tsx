import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { providerAdapters, configuredForOAuth } from "@/lib/integrations/providers";
import { listIntegrationAccounts } from "@/lib/integrations/sync";
import { connectIntegration, disconnectIntegrationAction, syncIntegrationAction } from "@/actions/integrations";
import { Badge, Card, btnGhost, btnPrimary } from "@/components/ui";

export const metadata = { title: "Health integrations" };

const tierCopy: Record<string, string> = {
  web_oauth: "Connect from the web app before App Store launch.",
  native: "Needs the future Expo app because data lives on-device.",
  approval_required: "Useful later, but gated by vendor approval.",
  planned: "Planned after the core sync layer proves reliable.",
};

function fmtDate(date: Date | null) {
  if (!date) return "never";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const { accounts, latestRunByAccountId } = await listIntegrationAccounts(user.id);
  const accountByProvider = new Map(accounts.map((account) => [account.provider, account]));
  const providers = Object.values(providerAdapters);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Health integrations</h1>
          <p className="mt-1 text-xs text-ink-faint">
            Imported health data stays private. Sharing a run, route, or milestone creates a draft; MacroVerse never posts automatically.
          </p>
        </div>
        <Link href="/settings" className={btnGhost}>
          Settings
        </Link>
      </div>

      {params.connected && <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">Connected. Run a sync to import the latest supported data.</p>}
      {params.error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{params.error}</p>}

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Sync rules</h2>
        <div className="mt-3 grid gap-2 text-xs text-ink-dim sm:grid-cols-2">
          <p>Manual entries win over imported summaries unless you explicitly replace them.</p>
          <p>Routes import private first, with start/end hiding before they can be shared.</p>
          <p>Default backfill is 30 days so the first sync is useful without being noisy.</p>
          <p>Duplicate provider samples are linked and ignored on repeat webhooks or syncs.</p>
        </div>
      </Card>

      <div className="grid gap-3">
        {providers.map((provider) => {
          const account = accountByProvider.get(provider.provider);
          const latestRun = account ? latestRunByAccountId.get(account.id) : null;
          const isOauthReady = provider.availability === "web_oauth" && configuredForOAuth(provider.provider);
          const canConnect = provider.availability === "web_oauth";
          return (
            <Card key={provider.provider} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold">{provider.label}</h2>
                    <Badge>{provider.availability.replace("_", " ")}</Badge>
                    {account && <Badge>{account.status}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">{tierCopy[provider.availability]}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-ink-faint">
                    {provider.metrics.map((metric) => metric.replace("_", " ")).join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {account?.status === "connected" ? (
                    <>
                      <form action={syncIntegrationAction}>
                        <input type="hidden" name="accountId" value={account.id} />
                        <button className={btnPrimary}>Sync</button>
                      </form>
                      <form action={disconnectIntegrationAction}>
                        <input type="hidden" name="accountId" value={account.id} />
                        <button className={btnGhost}>Disconnect</button>
                      </form>
                    </>
                  ) : canConnect ? (
                    <form action={connectIntegration}>
                      <input type="hidden" name="provider" value={provider.provider} />
                      <button className={isOauthReady ? btnPrimary : btnGhost}>{isOauthReady ? "Connect" : "Credentials needed"}</button>
                    </form>
                  ) : (
                    <button disabled className={`${btnGhost} opacity-60`}>
                      Later
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 grid gap-1 text-[10px] text-ink-faint sm:grid-cols-3">
                <span>Account: {account?.displayName ?? account?.providerAccountId ?? "not connected"}</span>
                <span>Last sync: {fmtDate(account?.lastSyncedAt ?? null)}</span>
                <span>
                  Last run: {latestRun ? `${latestRun.status}, ${latestRun.samplesWritten}/${latestRun.samplesRead} written` : "none"}
                </span>
              </div>
              {account?.statusMessage && <p className="mt-2 text-xs text-danger">{account.statusMessage}</p>}
            </Card>
          );
        })}
      </div>

      <p className="text-center text-[10px] text-ink-faint">
        Native Apple Health and Health Connect sync will use the same backend through the Expo app upload endpoint.
      </p>
    </div>
  );
}
