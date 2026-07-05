"use client";

/* Leaflet + OpenStreetMap tiles — free and keyless (docs/08 §1c).
 * Leaflet is loaded dynamically because it touches `window` at import time. */
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";

export type MapMarker = { lat: number; lng: number; label: string; emoji: string };

function zoomForRadius(km: number): number {
  if (km <= 2) return 14;
  if (km <= 5) return 13;
  if (km <= 10) return 12;
  return 11;
}

export function RestaurantMap({
  lat,
  lng,
  radiusKm,
  markers,
}: {
  lat: number;
  lng: number;
  radiusKm: number;
  markers: MapMarker[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersKey = JSON.stringify(markers);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !ref.current) return;
      mapRef.current?.remove();

      const map = L.map(ref.current).setView([lat, lng], zoomForRadius(radiusKm));
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      L.circle([lat, lng], {
        radius: radiusKm * 1000,
        color: "#a3e635",
        weight: 1,
        fillColor: "#a3e635",
        fillOpacity: 0.06,
      }).addTo(map);

      const pin = (emoji: string, big = false) =>
        L.divIcon({
          html: `<div style="font-size:${big ? 22 : 18}px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">${emoji}</div>`,
          className: "",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

      L.marker([lat, lng], { icon: pin("📍", true), zIndexOffset: 1000 }).addTo(map).bindPopup("You are here");
      for (const m of JSON.parse(markersKey) as MapMarker[]) {
        L.marker([m.lat, m.lng], { icon: pin(m.emoji) }).addTo(map).bindPopup(m.label);
      }
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng, radiusKm, markersKey]);

  return <div ref={ref} className="z-0 h-80 w-full rounded-xl border border-edge" />;
}
