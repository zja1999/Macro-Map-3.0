"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { inputCls, btnGhost } from "./ui";

/** Location controls for the restaurants tab: browser geolocation, address search
 *  (server-side Nominatim geocoding via the `q` param), and radius. */
export function LocationBar({ label, radiusKm, basePath = "/restaurants" }: { label: string; radiusKm: number; basePath?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);

  const push = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    next.delete("q");
    for (const [k, v] of Object.entries(updates)) next.set(k, v);
    router.push(`${basePath}?${next.toString()}`);
  };

  const locate = () => {
    if (!navigator.geolocation) return setGeoError(true);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        push({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5), label: "My location" });
      },
      () => {
        setLocating(false);
        setGeoError(true);
      },
      { timeout: 8000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={locate} disabled={locating} className={btnGhost}>
          {locating ? "Locating…" : "📍 Use my location"}
        </button>
        <form action={basePath} className="flex min-w-0 flex-1 gap-2">
          <input type="hidden" name="r" value={radiusKm} />
          <input name="q" placeholder="Search a city or address…" className={inputCls} />
          <button className={btnGhost}>Go</button>
        </form>
        <select
          value={radiusKm}
          onChange={(e) => push({ r: e.target.value })}
          className={`${inputCls} w-auto`}
          aria-label="Search radius"
        >
          {[2, 5, 10, 25].map((r) => (
            <option key={r} value={r}>
              within {r} km
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between text-xs text-ink-faint">
        <span>
          Showing options near <span className="font-medium text-ink-dim">{label}</span>
        </span>
        {geoError && <span className="text-carbs">Couldn&apos;t get your location — search an address instead.</span>}
      </div>
    </div>
  );
}
