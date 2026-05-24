"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "acquiring" | "active" | "error";

/**
 * GPS tracker with visible Start/Stop button.
 * Uses watchPosition for continuous updates and Wake Lock to prevent phone sleep.
 * The driver must keep the tab open (or install as PWA) for background tracking.
 */
export function GpsTracker({ loadId }: { loadId?: string }) {
  const [tracking, setTracking] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSentTimeRef = useRef<number>(0);

  const sendPing = useCallback(
    async (pos: GeolocationPosition) => {
      try {
        await fetch("/api/gps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed:
              pos.coords.speed != null
                ? Math.round(pos.coords.speed * 3.6)
                : undefined,
            heading: pos.coords.heading ?? undefined,
            accuracy: pos.coords.accuracy ?? undefined,
            loadId,
          }),
        });
        setLastSent(new Date());
        setStatus("active");
      } catch {
        // network error — keep trying silently
      }
    },
    [loadId],
  );

  const acquireWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      // not supported or denied — tracking still works, screen may sleep
    }
  }, []);

  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMsg("Geolocation not supported on this device.");
      return;
    }

    setTracking(true);
    setStatus("acquiring");
    setErrorMsg(null);

    await acquireWakeLock();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const prev = lastPosRef.current;
        const moved =
          !prev ||
          Math.abs(pos.coords.latitude - prev.lat) > 0.00005 ||
          Math.abs(pos.coords.longitude - prev.lng) > 0.00005;

        // Send every 60 s OR on meaningful movement
        if (now - lastSentTimeRef.current > 60_000 || moved) {
          lastPosRef.current = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          lastSentTimeRef.current = now;
          sendPing(pos);
        } else {
          setStatus("active");
        }
      },
      (err) => {
        setStatus("error");
        setErrorMsg(
          err.code === 1
            ? "Location permission denied. Enable it in browser settings."
            : "GPS signal unavailable.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
  }, [acquireWakeLock, sendPing]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    lastPosRef.current = null;
    lastSentTimeRef.current = 0;
    setTracking(false);
    setStatus("idle");
    setLastSent(null);
    setErrorMsg(null);
  }, []);

  // Re-acquire wake lock when tab becomes visible again (browser releases it on hide)
  useEffect(() => {
    const onVisibility = async () => {
      if (
        document.visibilityState === "visible" &&
        tracking &&
        !wakeLockRef.current
      ) {
        await acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [tracking, acquireWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation?.clearWatch(watchIdRef.current);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  const borderColor =
    status === "active"
      ? "border-emerald-500"
      : status === "error"
        ? "border-red-500"
        : status === "acquiring"
          ? "border-amber-500"
          : "border-border";

  const bgColor =
    status === "active"
      ? "bg-emerald-50 dark:bg-emerald-950/20"
      : status === "error"
        ? "bg-red-50 dark:bg-red-950/20"
        : status === "acquiring"
          ? "bg-amber-50 dark:bg-amber-950/20"
          : "bg-muted/30";

  const dotColor =
    status === "active"
      ? "bg-emerald-500"
      : status === "error"
        ? "bg-red-500"
        : status === "acquiring"
          ? "bg-amber-400"
          : "bg-gray-400";

  const statusText =
    status === "active"
      ? "Location tracking active"
      : status === "acquiring"
        ? "Acquiring GPS signal…"
        : status === "error"
          ? (errorMsg ?? "GPS unavailable")
          : "Location tracking is off";

  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 ${borderColor} ${bgColor}`}
    >
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <span className="relative flex h-3 w-3 shrink-0">
          {status === "active" && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
          )}
          <span
            className={`relative inline-flex h-3 w-3 rounded-full ${dotColor}`}
          />
        </span>

        <div>
          <p className="text-sm font-medium leading-tight">{statusText}</p>
          <p className="text-xs text-muted-foreground">
            {lastSent
              ? `Last ping: ${lastSent.toLocaleTimeString()}`
              : tracking
                ? "Waiting for first fix…"
                : "Keep this tab open while driving"}
          </p>
        </div>
      </div>

      <Button
        size="sm"
        variant={tracking ? "destructive" : "default"}
        onClick={tracking ? stopTracking : startTracking}
      >
        {tracking ? (
          <>
            <MapPinOff className="mr-1.5 h-3.5 w-3.5" />
            Stop
          </>
        ) : (
          <>
            <MapPin className="mr-1.5 h-3.5 w-3.5" />
            Start
          </>
        )}
      </Button>
    </div>
  );
}
