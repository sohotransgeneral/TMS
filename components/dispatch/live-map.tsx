"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type Position = {
  driverId: string;
  driverName: string;
  truckPlate: string | null;
  loadRef: string | null;
  loadId: string | null;
  loadStatus: string | null;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
};

type ZonePin = {
  id: string;
  lat: number;
  lng: number;
  status: string;
  note: string | null;
  driver: { firstName: string; lastName: string };
  createdAt: string;
};

const PIN_COLOR: Record<string, string> = {
  GREEN: "#16a34a",
  YELLOW: "#d97706",
  RED: "#dc2626",
};

const PIN_LABEL: Record<string, string> = {
  GREEN: "✅ Can go — no issues",
  YELLOW: "⚠️ Costly / difficult",
  RED: "🚫 Cannot go",
};

export function LiveMap({ token }: { token: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const zoneMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [positions, setPositions] = useState<Position[]>([]);
  const [zonePins, setZonePins] = useState<ZonePin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showZones, setShowZones] = useState(true);
  const [filterDriver, setFilterDriver] = useState<string>("__all__");

  // Init map
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-98.5795, 39.8283],
      zoom: 3.5,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Fetch zone pins
  const fetchZonePins = useCallback(async () => {
    try {
      const res = await fetch("/api/map-zones");
      if (res.ok) {
        const data = await res.json();
        setZonePins(data.pins ?? []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Poll driver positions
  useEffect(() => {
    let cancelled = false;
    async function fetchPositions() {
      try {
        const res = await fetch("/api/gps/live", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load positions");
        const data = await res.json();
        if (!cancelled) setPositions(data.positions ?? []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }
    fetchPositions();
    const id = setInterval(fetchPositions, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Poll zone pins every 30s
  useEffect(() => {
    fetchZonePins();
    const id = setInterval(fetchZonePins, 30_000);
    return () => clearInterval(id);
  }, [fetchZonePins]);

  // Update driver markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();

    for (const p of positions) {
      seen.add(p.driverId);
      let marker = drMarkersRef.current.get(p.driverId);
      const popupHtml = `
        <div style="font-size:12px;line-height:1.5">
          <strong>${escapeHtml(p.driverName)}</strong><br/>
          ${p.truckPlate ? `🚚 ${escapeHtml(p.truckPlate)}<br/>` : ""}
          ${p.loadRef ? `📦 <a href="/dispatch/loads/${p.loadId}" style="color:#2563eb">${escapeHtml(p.loadRef)}</a> <span style="color:#6b7280">(${escapeHtml(p.loadStatus ?? "")})</span><br/>` : `<span style="color:#d97706">⚠️ No active load</span><br/>`}
          ${p.speed != null ? `🚀 ${Math.round(p.speed)} km/h<br/>` : ""}
          <em style="color:#9ca3af">${new Date(p.recordedAt).toLocaleTimeString()}</em>
        </div>`;
      if (!marker) {
        const el = document.createElement("div");
        el.style.cssText =
          "width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer";
        marker = new mapboxgl.Marker(el)
          .setLngLat([p.lng, p.lat])
          .setPopup(new mapboxgl.Popup({ offset: 14 }).setHTML(popupHtml))
          .addTo(map);
        drMarkersRef.current.set(p.driverId, marker);
      } else {
        marker.setLngLat([p.lng, p.lat]);
        marker.getPopup()?.setHTML(popupHtml);
      }
      // Apply filter visibility
      const visible = filterDriver === "__all__" || p.driverId === filterDriver;
      marker.getElement().style.display = visible ? "" : "none";
    }
    for (const [id, marker] of drMarkersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        drMarkersRef.current.delete(id);
      }
    }
  }, [positions, filterDriver]);

  // Update zone pin markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Hide/show all
    for (const marker of zoneMarkersRef.current.values()) {
      marker.getElement().style.display = showZones ? "" : "none";
    }

    if (!showZones) return;

    const seen = new Set<string>();

    for (const pin of zonePins) {
      seen.add(pin.id);
      const color = PIN_COLOR[pin.status] ?? "#6b7280";
      const label = PIN_LABEL[pin.status] ?? pin.status;
      const name = `${pin.driver.firstName} ${pin.driver.lastName}`;
      // Check if this pin's driver matches the filter
      const pinDriverId = `zone__${name}`;
      const matchesFilter =
        filterDriver === "__all__" ||
        filterDriver === pinDriverId ||
        positions.find((p) => p.driverId === filterDriver)?.driverName === name;

      const popupHtml = `
        <div style="font-size:12px;line-height:1.6;min-width:160px">
          <div style="font-weight:700">${escapeHtml(name)}</div>
          <div style="display:inline-block;background:${color};color:#fff;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;margin:4px 0">
            ${escapeHtml(label)}
          </div>
          ${pin.note ? `<div style="color:#6b7280;margin-top:2px">${escapeHtml(pin.note)}</div>` : ""}
          <div style="color:#9ca3af;font-size:10px;margin-top:4px">
            ${new Date(pin.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>`;

      if (!zoneMarkersRef.current.has(pin.id)) {
        const el = document.createElement("div");
        el.style.cssText = `
          width:18px;height:18px;border-radius:50%;
          background:${color};border:3px solid #fff;
          box-shadow:0 2px 6px rgba(0,0,0,0.35);cursor:pointer;
          opacity:0.85;
        `;
        el.style.display = matchesFilter ? "" : "none";
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([pin.lng, pin.lat])
          .setPopup(new mapboxgl.Popup({ offset: 14 }).setHTML(popupHtml))
          .addTo(map);
        zoneMarkersRef.current.set(pin.id, marker);
      } else {
        const m = zoneMarkersRef.current.get(pin.id)!;
        const mEl = m.getElement();
        mEl.style.background = color;
        mEl.style.display = matchesFilter ? "" : "none";
        m.getPopup()?.setHTML(popupHtml);
      }
    }

    for (const [id, marker] of zoneMarkersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        zoneMarkersRef.current.delete(id);
      }
    }
  }, [zonePins, showZones, filterDriver, positions]);

  if (!token) {
    return (
      <div className="grid h-[60vh] place-items-center rounded-lg border bg-card p-6 text-center">
        <div>
          <p className="font-medium">Mapbox token missing.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to <code>.env.local</code>
            .
          </p>
        </div>
      </div>
    );
  }

  const greenCount = zonePins.filter((p) => p.status === "GREEN").length;
  const yellowCount = zonePins.filter((p) => p.status === "YELLOW").length;
  const redCount = zonePins.filter((p) => p.status === "RED").length;

  // Build unique driver list for filter: from GPS positions + zone pin authors
  const driverOptions = [
    ...positions.map((p) => ({ id: p.driverId, label: p.driverName })),
    ...zonePins
      .map((pin) => ({
        id: `zone__${pin.driver.firstName} ${pin.driver.lastName}`,
        label: `${pin.driver.firstName} ${pin.driver.lastName}`,
      }))
      .filter((d) => !positions.find((p) => p.driverName === d.label)),
  ].filter((d, i, arr) => arr.findIndex((x) => x.id === d.id) === i);

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">
            {positions.length} active driver{positions.length !== 1 ? "s" : ""}{" "}
            on map
          </span>
          {driverOptions.length > 0 && (
            <select
              value={filterDriver}
              onChange={(e) => setFilterDriver(e.target.value)}
              className="rounded border border-border bg-card px-2 py-0.5 text-xs text-foreground"
            >
              <option value="__all__">All drivers</option>
              {driverOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Zone pins summary + toggle */}
        <div className="flex items-center gap-3">
          {zonePins.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-muted-foreground">
                Driver zones:
              </span>
              {greenCount > 0 && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 font-semibold">
                  ●&nbsp;{greenCount}
                </span>
              )}
              {yellowCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 font-semibold">
                  ●&nbsp;{yellowCount}
                </span>
              )}
              {redCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 font-semibold">
                  ●&nbsp;{redCount}
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => setShowZones((v) => !v)}
            className={`rounded px-2 py-0.5 text-xs border transition-colors ${showZones ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"}`}
          >
            {showZones ? "Hide zones" : "Show zones"}
          </button>
          <span className="text-xs text-muted-foreground">
            Auto-refresh 15s
          </span>
        </div>
      </div>

      {/* Zone legend */}
      {showZones && zonePins.length > 0 && (
        <div className="flex flex-wrap gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
          <span className="font-medium text-muted-foreground">
            Zone pins placed by drivers:
          </span>
          <span className="flex items-center gap-1 text-green-700">
            ● Green — no issues
          </span>
          <span className="flex items-center gap-1 text-amber-700">
            ● Yellow — costly / difficult
          </span>
          <span className="flex items-center gap-1 text-red-700">
            ● Red — cannot go
          </span>
          <span className="ml-auto text-muted-foreground">
            Click a pin for details
          </span>
        </div>
      )}

      <div
        ref={containerRef}
        className="h-[70vh] w-full overflow-hidden rounded-lg border"
      />
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
