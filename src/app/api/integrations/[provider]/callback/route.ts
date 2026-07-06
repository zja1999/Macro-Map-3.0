import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProviderAdapter } from "@/lib/integrations/providers";
import { upsertIntegrationAccount } from "@/lib/integrations/sync";
import type { IntegrationProvider } from "@/lib/integrations/types";

function appUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const adapter = getProviderAdapter(provider);
  const user = await getCurrentUser();
  if (!adapter || !adapter.exchangeCode || !user) return NextResponse.redirect(new URL("/login", req.url));

  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error) return NextResponse.redirect(new URL(`/settings/integrations?error=${encodeURIComponent(error)}`, req.url));

  const jar = await cookies();
  const cookieName = `mm_oauth_${provider}`;
  const expectedState = jar.get(cookieName)?.value;
  jar.delete(cookieName);
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/settings/integrations?error=OAuth%20state%20could%20not%20be%20verified", req.url));
  }

  try {
    const redirectUri = `${appUrl(req)}/api/integrations/${provider}/callback`;
    const exchanged = await adapter.exchangeCode(code, redirectUri);
    await upsertIntegrationAccount({ userId: user.id, provider: provider as IntegrationProvider, ...exchanged });
    return NextResponse.redirect(new URL("/settings/integrations?connected=1", req.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not connect provider";
    return NextResponse.redirect(new URL(`/settings/integrations?error=${encodeURIComponent(message)}`, req.url));
  }
}
