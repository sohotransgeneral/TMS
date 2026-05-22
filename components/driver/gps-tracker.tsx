"use client";

import { useEffect, useRef } from "react";

/**
 * Sends a GPS ping to the server every `intervalMs`. Renders nothing.
 * Mount only on driver pages when there is an active load.
 */
export function GpsTracker({
  loadId,
  intervalMs = 60_000,
}: {
  loadId?: string;
  intervalMs?: number;
}) {
  const lastSent = useRef<number>(0);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;

    async function send() {
      if (cancelled) return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
          const now = Date.now();
          if (now - lastSent.current < intervalMs - 1000) return;
          lastSent.current = now;
          try {
            await fetch("/api/gps", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                speed:
                  pos.coords.speed != null ? pos.coords.speed * 3.6 : undefined,
                heading: pos.coords.heading ?? undefined,
                accuracy: pos.coords.accuracy ?? undefined,
                loadId,
              }),
            });
          } catch {
            // silent
          }
        },
        () => {
          /* permission denied / unavailable — silent */
        },
        { enableHighAccuracy: true, maximumAge: 15_000, timeout: 10_000 },
      );
    }

    send();
    const id = setInterval(send, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [loadId, intervalMs]);

  return null;
}
