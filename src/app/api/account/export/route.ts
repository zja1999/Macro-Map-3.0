import { getCurrentUser } from "@/lib/auth";
import { buildAccountExport } from "@/lib/accountExport";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const payload = await buildAccountExport(user.id);
  const date = new Date().toISOString().slice(0, 10);
  const username = user.profile.username.replace(/[^a-z0-9_-]/gi, "-");

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="macroverse-${username}-${date}.json"`,
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
