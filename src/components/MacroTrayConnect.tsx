"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { btnPrimary, btnGhost } from "@/components/ui";

type Pairing = { deviceCode: string; approvalUrl: string };

export function MacroTrayConnect() {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const started = useRef(false);

  const start = async () => {
    setError(null);
    setPairing(null);
    const response = await fetch("/api/macrotray/pair/start", { method: "POST" });
    const data = (await response.json()) as Pairing & { error?: string };
    if (!response.ok) return setError(data.error ?? "Could not start pairing.");
    setPairing(data);
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, []);

  useEffect(() => {
    if (!pairing) return;
    const poll = window.setInterval(async () => {
      const status = await fetch("/api/macrotray/pair/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceCode: pairing.deviceCode }),
        cache: "no-store",
      });
      const data = (await status.json()) as { status?: string };
      if (data.status !== "approved") {
        if (["expired", "invalid", "consumed"].includes(data.status ?? "")) {
          window.clearInterval(poll);
          setError("Pairing expired. Start a new connection.");
        }
        return;
      }
      window.clearInterval(poll);
      setConnecting(true);
      const exchange = await fetch("/api/macrotray/pair/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceCode: pairing.deviceCode }),
      });
      if (exchange.ok) window.location.replace("/macrotray");
      else {
        setConnecting(false);
        setError("Pairing expired. Start a new connection.");
      }
    }, 1500);
    return () => window.clearInterval(poll);
  }, [pairing]);

  const approvalHref = pairing?.approvalUrl ?? "#";
  return (
    <div className="mx-auto flex min-h-[520px] max-w-sm flex-col items-center justify-center gap-5 text-center">
      <div className="text-3xl">⚡</div>
      <div>
        <h1 className="text-xl font-black">Connect MacroTray</h1>
        <p className="mt-2 text-sm text-ink-dim">Approve this widget in your browser. Your password and Google sign-in stay on MacroVerse.</p>
      </div>
      {pairing && (
        <a href={approvalHref} className={`${btnPrimary} flex items-center gap-2 px-5 py-3`}>
          Open browser to connect <ExternalLink size={16} />
        </a>
      )}
      <p className="text-xs text-ink-faint">{connecting ? "Connection approved — finishing sign-in…" : pairing ? "Waiting for approval…" : "Creating a secure pairing request…"}</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="button" onClick={() => void start()} className={`${btnGhost} flex items-center gap-2`}><RefreshCw size={14} /> Start again</button>
    </div>
  );
}
