"use client";

import { useEffect } from "react";

/** Registers production service worker for offline shell. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Only register in production builds (avoid turbopack HMR issues)
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.update().catch(() => undefined);
      })
      .catch(() => undefined);
  }, []);

  return null;
}
