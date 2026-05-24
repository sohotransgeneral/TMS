"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Registers the PWA service worker and shows a toast when an update is available.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    )
      return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              toast("Update available", {
                description: "Reload to get the latest version.",
                action: {
                  label: "Reload",
                  onClick: () => window.location.reload(),
                },
                duration: Infinity,
              });
            }
          });
        });
      })
      .catch(() => {
        /* SW not available — continue without it */
      });
  }, []);

  return null;
}
