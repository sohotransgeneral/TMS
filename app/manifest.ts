import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TMS — Transport Management",
    short_name: "TMS",
    description: "Transport Management System: dispatch, drivers, trucks, invoicing, GPS tracking.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    categories: ["business", "productivity", "navigation"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Driver Dashboard",
        url: "/driver/dashboard",
        description: "GPS tracking & active loads",
      },
      {
        name: "Dispatch Board",
        url: "/dispatch",
        description: "Live dispatch board",
      },
      {
        name: "Loads",
        url: "/loads",
        description: "All loads",
      },
    ],
  };
}
