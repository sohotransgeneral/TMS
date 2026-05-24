"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Trash2 } from "lucide-react";

type ZonePin = {
  id: string;
  lat: number;
  lng: number;
  status: "GREEN" | "YELLOW" | "RED";
  note: string | null;
  driver: { firstName: string; lastName: string };
  createdAt: string;
};

const STATUS_COLOR: Record<string, string> = {
  GREEN: "#16a34a",
  YELLOW: "#d97706",
  RED: "#dc2626",
};

const STATUS_LABEL: Record<string, string> = {
  GREEN: "✅ Can go — no issues",
  YELLOW: "⚠️ Can go — but costly / difficult",
  RED: "🚫 Cannot go",
};

const STATUS_NEXT: Record<string, string> = {
  GREEN: "YELLOW",
  YELLOW: "RED",
  RED: "DELETE",
};

export function DriverZoneMap({
  token,
  pickupLat,
  pickupLng,
  pickupAddress,
  deliveryLat,
  deliveryLng,
  deliveryAddress,
}: {
  token: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupAddress?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryAddress?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const myMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [pins, setPins] = useState<ZonePin[]>([]);
  const [hint, setHint] = useState(true);

  // Load existing pins
  const fetchPins = useCallback(async () => {
    try {
      const res = await fetch("/api/map-zones");
      if (res.ok) {
        const data = await res.json();
        setPins((data.pins ?? []) as ZonePin[]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Init map
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center:
        pickupLng != null && pickupLat != null
          ? [pickupLng, pickupLat]
          : [-98.5795, 39.8283],
      zoom: pickupLat != null ? 6 : 3.5,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      // Pickup marker — violet P
      if (pickupLat != null && pickupLng != null) {
        const el = makeEndpointEl("#7c3aed", "P");
        new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([pickupLng, pickupLat])
          .setPopup(
            new mapboxgl.Popup({ offset: 14 }).setHTML(
              `<div style="font-size:12px;color:#111827"><b>📍 Pickup</b>${pickupAddress ? `<br/>${escapeHtml(pickupAddress)}` : ""}</div>`,
            ),
          )
          .addTo(map);
      }
      // Delivery marker — black D
      if (deliveryLat != null && deliveryLng != null) {
        const el = makeEndpointEl("#111827", "D");
        new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([deliveryLng, deliveryLat])
          .setPopup(
            new mapboxgl.Popup({ offset: 14 }).setHTML(
              `<div style="font-size:12px;color:#111827"><b>🏁 Delivery</b>${deliveryAddress ? `<br/>${escapeHtml(deliveryAddress)}` : ""}</div>`,
            ),
          )
          .addTo(map);
      }
      // Fit to show both if available
      if (
        pickupLat != null &&
        pickupLng != null &&
        deliveryLat != null &&
        deliveryLng != null
      ) {
        map.fitBounds(
          new mapboxgl.LngLatBounds(
            [pickupLng, pickupLat],
            [deliveryLng, deliveryLat],
          ),
          { padding: 60, maxZoom: 8, duration: 800 },
        );
      }
    });

    // Click on empty area → create GREEN pin
    map.on("click", async (e) => {
      const features = map.queryRenderedFeatures(e.point);
      // ignore clicks on existing markers (they handle themselves)
      if (features.some((f) => f.layer?.id?.startsWith("zone-marker"))) return;

      try {
        const res = await fetch("/api/map-zones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: e.lngLat.lat, lng: e.lngLat.lng }),
        });
        if (res.ok) {
          setHint(false);
          await fetchPins();
        }
      } catch {
        /* ignore */
      }
    });

    mapRef.current = map;
    fetchPins();

    return () => {
      map.remove();
      mapRef.current = null;
      myMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Watch driver's own GPS position and show blue dot on map
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const map = mapRef.current;
        if (!map) return;
        if (!myMarkerRef.current) {
          const el = document.createElement("div");
          el.style.cssText =
            "width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.45)";
          myMarkerRef.current = new mapboxgl.Marker({
            element: el,
            anchor: "center",
          })
            .setLngLat([lng, lat])
            .setPopup(
              new mapboxgl.Popup({ offset: 14 }).setHTML(
                `<div style="font-size:12px;color:#111827"><b>📍 You are here</b></div>`,
              ),
            )
            .addTo(map);
        } else {
          myMarkerRef.current.setLngLat([lng, lat]);
        }
      },
      () => {
        /* permission denied or unavailable — silently ignore */
      },
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Sync markers to pins state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();

    for (const pin of pins) {
      seen.add(pin.id);
      const color = STATUS_COLOR[pin.status] ?? "#6b7280";

      if (!markersRef.current.has(pin.id)) {
        // Build marker element
        const el = document.createElement("div");
        el.style.cssText = `
          width:22px;height:22px;border-radius:50%;
          background:${color};border:3px solid #fff;
          box-shadow:0 2px 6px rgba(0,0,0,0.35);
          cursor:pointer;transition:transform 0.15s;
        `;
        el.title = STATUS_LABEL[pin.status] ?? pin.status;
        el.addEventListener("mouseenter", () => {
          el.style.transform = "scale(1.25)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.transform = "scale(1)";
        });

        // Click on existing pin → cycle status
        el.addEventListener("click", async (e) => {
          e.stopPropagation();
          const next = STATUS_NEXT[pin.status];
          try {
            const res = await fetch(`/api/map-zones/${pin.id}`, {
              method: "PATCH",
            });
            if (res.ok) await fetchPins();
          } catch {
            /* ignore */
          }
        });

        const popup = new mapboxgl.Popup({
          offset: 14,
          closeButton: true,
        }).setHTML(buildPopupHtml(pin));

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([pin.lng, pin.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.set(pin.id, marker);
      } else {
        // Update color if status changed
        const existing = markersRef.current.get(pin.id)!;
        const existingEl = existing.getElement();
        existingEl.style.background = color;
        existingEl.title = STATUS_LABEL[pin.status] ?? pin.status;
        existing.getPopup()?.setHTML(buildPopupHtml(pin));
      }
    }

    // Remove deleted pins
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, [pins, fetchPins]);

  if (!token) {
    return (
      <div className="grid h-60 place-items-center rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
        Mapbox token missing — add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to
        .env.local
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3 text-green-600" /> Click on map to place a
          pin
        </span>
        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-green-700 font-medium">
          ● GREEN — no issues
        </span>
        <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 font-medium">
          ● YELLOW — costly
        </span>
        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-700 font-medium">
          ● RED — can&apos;t go
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[#7c3aed]" />{" "}
          Pickup
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[#2563eb]" />{" "}
          You
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[#111827]" />{" "}
          Delivery
        </span>
        <span className="ml-auto text-xs opacity-60">
          Click pin to cycle status • 3rd click removes it
        </span>
      </div>

      {hint && pins.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          Click anywhere on the map to mark a zone. Tap again to change
          availability.
        </div>
      )}

      {/* Pin count */}
      {pins.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {pins.length} zone pin{pins.length !== 1 ? "s" : ""} placed
          </span>
          <button
            onClick={async () => {
              if (!confirm("Remove all your zone pins?")) return;
              await Promise.all(
                pins.map((p) =>
                  fetch(`/api/map-zones/${p.id}`, { method: "DELETE" }),
                ),
              );
              await fetchPins();
            }}
            className="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-3 w-3" /> Clear all
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className="h-[55vh] w-full overflow-hidden rounded-lg border"
      />
    </div>
  );
}

function buildPopupHtml(pin: ZonePin): string {
  const name = `${pin.driver.firstName} ${pin.driver.lastName}`;
  const color = STATUS_COLOR[pin.status] ?? "#6b7280";
  const label = STATUS_LABEL[pin.status] ?? pin.status;
  return `
    <div style="font-size:12px;line-height:1.6;min-width:160px">
      <div style="font-weight:700;margin-bottom:4px">${escapeHtml(name)}</div>
      <div style="display:inline-block;background:${color};color:#fff;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;margin-bottom:6px">
        ${escapeHtml(label)}
      </div>
      ${pin.note ? `<div style="color:#6b7280;margin-top:4px">${escapeHtml(pin.note)}</div>` : ""}
      <div style="color:#9ca3af;font-size:10px;margin-top:4px">
        ${new Date(pin.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </div>
      <div style="color:#9ca3af;font-size:10px;margin-top:2px">Click to cycle • 3rd click removes</div>
    </div>`;
}

function makeEndpointEl(color: string, letter: string) {
  const el = document.createElement("div");
  el.style.cssText = `
    width:22px;height:22px;border-radius:50%;
    background:${color};border:2.5px solid #fff;
    box-shadow:0 2px 6px rgba(0,0,0,0.4);
    display:flex;align-items:center;justify-content:center;
    font-size:10px;font-weight:700;color:#fff;cursor:pointer;
  `;
  el.textContent = letter;
  return el;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
