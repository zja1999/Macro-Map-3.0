"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ScanBarcode } from "lucide-react";
import { lookupBarcode } from "@/actions/barcode";
import { FullScreenModal } from "@/components/overlays";
import { inputCls, btnPrimary } from "@/components/ui";
import type { IScannerControls } from "@zxing/browser";

/**
 * Barcode scanning as a full-screen overlay (plan §4.1): viewfinder with a
 * dimmed surround, torch-free zxing web decode, and manual digit entry as the
 * always-works fallback. Opens from an icon button inside the Add Food search
 * field. On a hit, lookupBarcode redirects into the search flow pre-filled
 * with the product — the URL change closes the overlay.
 * (Capacitor swaps the decode engine for ML Kit behind this same component.)
 */
export function BarcodeScanButton({ date, slot }: { date: string; slot: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(lookupBarcode, undefined);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const pathname = usePathname();
  const search = useSearchParams();

  // lookupBarcode redirects (same route, new q=) — close when the URL moves
  useEffect(() => setOpen(false), [pathname, search]);

  useEffect(() => {
    if (!open) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      return;
    }
    let cancelled = false;
    setCameraError(null);
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (result && /^\d{8,14}$/.test(result.getText())) {
            if (inputRef.current) inputRef.current.value = result.getText();
            controlsRef.current?.stop();
            controlsRef.current = null;
            formRef.current?.requestSubmit();
          }
        });
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
      } catch {
        if (!cancelled) setCameraError("Camera unavailable — type the digits below instead.");
      }
    })();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open]);

  return (
    <FullScreenModal
      open={open}
      onOpenChange={setOpen}
      title="Scan a barcode"
      trigger={
        <button
          type="button"
          aria-label="Scan a barcode"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-text-secondary transition hover:bg-surface-2 hover:text-accent"
        >
          <ScanBarcode size={18} />
        </button>
      }
    >
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1 bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="h-full w-full object-cover" />
          {/* viewfinder: accent frame, dimmed surround */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-40 w-72 max-w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
          />
          <p className="absolute inset-x-0 bottom-4 text-center text-xs font-medium text-white/80">
            {cameraError ?? "Line the barcode up inside the frame"}
          </p>
        </div>

        <div className="space-y-2 border-t border-border p-4">
          <form ref={formRef} action={action} className="flex gap-2">
            <input type="hidden" name="logDate" value={date} />
            <input type="hidden" name="mealSlot" value={slot} />
            <input
              ref={inputRef}
              name="barcode"
              inputMode="numeric"
              pattern="\d{8,14}"
              required
              placeholder="…or type the barcode digits"
              className={inputCls}
              aria-label="Barcode digits"
            />
            <button disabled={pending} className={btnPrimary}>
              {pending ? "Looking up…" : "Look up"}
            </button>
          </form>
          {state?.error && <p className="text-sm text-danger">{state.error}</p>}
          <p className="text-[10px] text-text-tertiary">
            Nutrition comes from Open Food Facts (per 100 g) and lands as an unverified community food — correct it
            like any other entry if the label disagrees.
          </p>
        </div>
      </div>
    </FullScreenModal>
  );
}
