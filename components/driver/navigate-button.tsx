"use client";

import { useState, useRef, useEffect } from "react";
import { Navigation } from "lucide-react";

interface Props {
  address: string;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
}

export function NavigateButton({ address, city, country, lat, lng }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const query = encodeURIComponent(
    lat != null && lng != null
      ? `${lat},${lng}`
      : `${address} ${city ?? ""} ${country ?? ""}`.trim(),
  );
  const latLng = lat != null && lng != null ? `${lat},${lng}` : null;

  const apps = [
    {
      label: "Google Maps",
      icon: "🗺️",
      href: latLng
        ? `https://www.google.com/maps/dir/?api=1&destination=${latLng}`
        : `https://www.google.com/maps/search/?api=1&query=${query}`,
    },
    {
      label: "Waze",
      icon: "🚗",
      href: latLng
        ? `https://waze.com/ul?ll=${latLng}&navigate=yes`
        : `https://waze.com/ul?q=${query}&navigate=yes`,
    },
    {
      label: "Apple Maps",
      icon: "🍎",
      href: latLng
        ? `https://maps.apple.com/?daddr=${latLng}`
        : `https://maps.apple.com/?q=${query}`,
    },
  ];

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 active:scale-95 transition-transform"
      >
        <Navigation className="h-3 w-3" />
        Navigate
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border bg-popover shadow-lg overflow-hidden">
          {apps.map((app) => (
            <a
              key={app.label}
              href={app.href}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-accent transition-colors"
            >
              <span className="text-base">{app.icon}</span>
              <span>{app.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
