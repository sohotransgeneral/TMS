"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type TripPoint = {
  lat: number;
  lng: number;
  /** Shown in the marker popup, e.g. "Lamont, CA · L-2026-00013". */
  label: string;
};

/**
 * The trip as the truck actually drives it:
 *
 *   previous delivery ──empty──▶ pickup ──loaded──▶ delivery
 *
 * The empty leg is drawn dashed and amber precisely because it is the part
 * nobody pays for — seeing a dashed line stretch across the country is the
 * fastest way to notice that a deadhead figure is wrong.
 *
 * Real road geometry comes from the Directions API, with a straight line as
 * the fallback so the map still draws when that request fails.
 */
export function LoadTripMap({
  token,
  emptyFrom,
  pickup,
  delivery,
  emptyMiles,
  loadedMiles,
}: {
  token: string | null;
  emptyFrom?: TripPoint | null;
  pickup?: TripPoint | null;
  delivery?: TripPoint | null;
  emptyMiles?: number | null;
  loadedMiles?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    if (!pickup || !delivery) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [pickup.lng, pickup.lat],
      zoom: 4,
      // Wheel zoom needs Ctrl (two fingers on touch). Without this the map
      // swallows the wheel and the page stops scrolling once the cursor
      // crosses it; disabling zoom outright is worse still. Mapbox shows the
      // "use ctrl + scroll" hint on its own.
      cooperativeGestures: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", async () => {
      const stops: [TripPoint, string, string][] = [];
      if (emptyFrom) stops.push([emptyFrom, "#d97706", "E"]);
      stops.push([pickup, "#7c3aed", "P"]);
      stops.push([delivery, "#111827", "D"]);

      const titles: Record<string, string> = {
        E: "Empty from — previous delivery",
        P: "Pickup",
        D: "Delivery",
      };
      for (const [point, color, letter] of stops) {
        new mapboxgl.Marker({ element: marker(color, letter), anchor: "center" })
          .setLngLat([point.lng, point.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 14 }).setHTML(
              `<div style="font-size:12px"><b>${titles[letter]}</b><br/>${esc(point.label)}</div>`,
            ),
          )
          .addTo(map);
      }

      if (emptyFrom) {
        await drawLeg(map, "empty", emptyFrom, pickup, token, {
          color: "#d97706",
          dashed: true,
        });
      }
      await drawLeg(map, "loaded", pickup, delivery, token, {
        color: "#2563eb",
        dashed: false,
      });

      const bounds = new mapboxgl.LngLatBounds();
      for (const [point] of stops) bounds.extend([point.lng, point.lat]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 9, duration: 700 });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token || !pickup || !delivery) return null;

  return (
    <div className="space-y-2">
      {/* Square rather than a letterbox: a cross-country trip is as tall as it
          is wide, and a wide strip crops the route to a thin horizontal band.
          Capped so it doesn't take over the page on a large screen. */}
      <div
        ref={containerRef}
        className="aspect-square w-full overflow-hidden rounded-lg border"
      />
      <div className="flex flex-wrap gap-4 px-1 text-xs text-muted-foreground">
        {emptyFrom && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-[#d97706]" />
            Empty{emptyMiles != null && ` · ${Math.round(emptyMiles).toLocaleString("en-US")} mi`}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 bg-[#2563eb]" />
          Loaded
          {loadedMiles != null &&
            ` · ${Math.round(loadedMiles).toLocaleString("en-US")} mi`}
        </span>
      </div>
    </div>
  );
}

async function drawLeg(
  map: mapboxgl.Map,
  id: string,
  from: TripPoint,
  to: TripPoint,
  token: string,
  style: { color: string; dashed: boolean },
) {
  const coordinates = await routeGeometry(from, to, token);

  map.addSource(id, {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates },
    },
  });
  map.addLayer({
    id: `${id}-line`,
    type: "line",
    source: id,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": style.color,
      "line-width": style.dashed ? 3 : 4,
      "line-opacity": style.dashed ? 0.85 : 0.9,
      ...(style.dashed ? { "line-dasharray": [1.5, 1.5] } : {}),
    },
  });
}

/** Road geometry between two stops; straight line if Directions is unavailable. */
async function routeGeometry(
  from: TripPoint,
  to: TripPoint,
  token: string,
): Promise<[number, number][]> {
  const straight: [number, number][] = [
    [from.lng, from.lat],
    [to.lng, to.lat],
  ];
  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?access_token=${token}&overview=simplified&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return straight;
    const json = await res.json();
    const coords = json?.routes?.[0]?.geometry?.coordinates;
    return Array.isArray(coords) && coords.length > 1 ? coords : straight;
  } catch {
    return straight;
  }
}

function marker(color: string, letter: string) {
  const el = document.createElement("div");
  el.style.cssText = `
    width:24px;height:24px;border-radius:50%;
    background:${color};border:2.5px solid #fff;
    box-shadow:0 2px 6px rgba(0,0,0,0.4);
    display:flex;align-items:center;justify-content:center;
    font-size:11px;font-weight:700;color:#fff;cursor:pointer;
  `;
  el.textContent = letter;
  return el;
}

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
