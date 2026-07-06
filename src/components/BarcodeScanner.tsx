"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { lookupBarcode } from "@/actions/barcode";
import { Card, inputCls, btnPrimary, btnGhost } from "@/components/ui";
import type { IScannerControls } from "@zxing/browser";

/** Scan tab on Add Food (docs/10 §2): camera decode via @zxing/browser, with
 * manual digit entry as the always-works fallback (no camera permission needed). */
export function BarcodeScanner({ date, slot }: { date: string; slot: string }) {
  const [state, action, pending] = useActionState(lookupBarcode, undefined);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const stopCamera = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  };
  useEffect(() => stopCamera, []);

  const startCamera = async () => {
    setCameraError(null);
    setScanning(true);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      controlsRef.current = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result && /^\d{8,14}$/.test(result.getText())) {
          if (inputRef.current) inputRef.current.value = result.getText();
          stopCamera();
          formRef.current?.requestSubmit();
        }
      });
    } catch {
      setCameraError("Camera unavailable — type the digits below instead.");
      setScanning(false);
    }
  };

  return (
    <Card className="space-y-3 p-4">
      {scanning ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="aspect-video w-full rounded-lg bg-black object-cover" />
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-faint">Point at the barcode…</p>
            <button type="button" onClick={stopCamera} className={btnGhost}>
              Stop
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startCamera}
          className="w-full rounded-lg border border-dashed border-edge py-6 text-sm text-ink-dim transition hover:border-accent hover:text-accent"
        >
          📷 Scan with camera
        </button>
      )}
      {cameraError && <p className="text-xs text-carbs">{cameraError}</p>}

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
      <p className="text-[10px] text-ink-faint">
        Nutrition comes from Open Food Facts (per 100 g) and lands as an unverified community food — correct it like
        any other entry if the label disagrees.
      </p>
    </Card>
  );
}
