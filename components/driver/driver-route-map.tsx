"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface Props {
  token: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  pickupAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string;
}

export function DriverRouteMap({
  token,
  pickupLat,
  pickupLng,
  pickupAddress,
  deliveryLat,
  deliveryLng,
  deliveryAddress,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [ready, setReady] = useState(false);

  // Init map
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;

    // Default center = midpoint of pickup/delivery or pickup alone
    const centerLat =
      pickupLat != null && deliveryLat != null
        ? (pickupLat + deliveryLat) / 2
        : (pickupLat ?? 47.0);
    const centerLng =
      pickupLng != null && deliveryLng != null
        ? (pickupLng + deliveryLng) / 2
        : (pickupLng ?? 28.8);

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [centerLng, centerLat],
      zoom: 5,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    mapRef.current.on("load", () => {
      const map = mapRef.current!;

      // Pickup marker — purple P
      if (pickupLat != null && pickupLng != null) {
        const el = makeMarker("#7c3aed", "P");
        new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([pickupLng, pickupLat])
          .setPopup(
            new mapboxgl.Popup({ offset: 14 }).setHTML(
              `<div style="font-size:12px"><b>📍 Pickup</b><br/>${esc(pickupAddress)}</div>`,
            ),
          )
          .addTo(map);
      }

      // Delivery marker — black D
      if (deliveryLat != null && deliveryLng != null) {
        const el = makeMarker("#111827", "D");
        new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([deliveryLng, deliveryLat])
          .setPopup(
            new mapboxgl.Popup({ offset: 14 }).setHTML(
              `<div style="font-size:12px"><b>🏁 Delivery</b><br/>${esc(deliveryAddress)}</div>`,
            ),
          )
          .addTo(map);
      }

      // Initial route line (pickup → delivery, no driver pos yet)
      drawRoute(map, null, null);

      // Fit bounds to show both endpoints
      if (
        pickupLat != null &&
        pickupLng != null &&
        deliveryLat != null &&
        deliveryLng != null
      ) {
        const bounds = new mapboxgl.LngLatBounds(
          [pickupLng, pickupLat],
          [deliveryLng, deliveryLat],
        );
        map.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 800 });
      }

      setReady(true);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      driverMarkerRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Track driver position with geolocation and update marker + route
  useEffect(() => {
    if (!ready) return;
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const map = mapRef.current;
        if (!map) return;

        if (!driverMarkerRef.current) {
          const el = document.createElement("div");
          el.style.cssText =
            "width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)";
          driverMarkerRef.current = new mapboxgl.Marker({ element: el })
            .setLngLat([lng, lat])
            .setPopup(
              new mapboxgl.Popup({ offset: 14 }).setHTML(
                `<div style="font-size:12px"><b>📍 You are here</b></div>`,
              ),
            )
            .addTo(map);
        } else {
          driverMarkerRef.current.setLngLat([lng, lat]);
        }

        drawRoute(map, lat, lng);
      },
      () => {
        /* ignore errors */
      },
      { enableHighAccuracy: true },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [ready]);

  function drawRoute(
    map: mapboxgl.Map,
    driverLat: number | null,
    driverLng: number | null,
  ) {
    const coords: [number, number][] = [];
    if (pickupLng != null && pickupLat != null)
      coords.push([pickupLng, pickupLat]);
    if (driverLng != null && driverLat != null)
      coords.push([driverLng, driverLat]);
    if (deliveryLng != null && deliveryLat != null)
      coords.push([deliveryLng, deliveryLat]);
    if (coords.length < 2) return;

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords },
    };

    if (map.getSource("driver-route")) {
      (map.getSource("driver-route") as mapboxgl.GeoJSONSource).setData(
        geojson,
      );
    } else {
      map.addSource("driver-route", { type: "geojson", data: geojson });
      map.addLayer({
        id: "driver-route-line",
        type: "line",
        source: "driver-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#2563eb",
          "line-width": 2.5,
          "line-dasharray": [2, 3],
          "line-opacity": 0.7,
        },
      });
    }
  }

  if (!token) return null;

  return (
    <div className="space-y-1">
      <div
        ref={containerRef}
        className="h-56 w-full overflow-hidden rounded-lg border"
      />
      <div className="flex gap-3 px-1 text-xs text-muted-foreground">
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
      </div>
    </div>
  );
}

function makeMarker(color: string, letter: string) {
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

function esc(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
