"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QrScanner({
  onScan,
  active,
}: {
  onScan: (text: string) => void;
  active: boolean;
}) {
  const regionId = "securetrack-qr-reader";
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [running, setRunning] = useState(false);
  const lastScan = useRef("");

  useEffect(() => {
    if (!active) {
      stopScanner();
      return;
    }

    let cancelled = false;

    async function start() {
      setStarting(true);
      setError(null);
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (decoded && decoded !== lastScan.current) {
              lastScan.current = decoded;
              onScan(decoded);
              // allow re-scan after short pause
              setTimeout(() => {
                lastScan.current = "";
              }, 3000);
            }
          },
          () => {
            /* ignore frame miss */
          }
        );
        if (!cancelled) setRunning(true);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Camera unavailable. Paste QR data instead."
        );
        setRunning(false);
      } finally {
        setStarting(false);
      }
    }

    start();
    return () => {
      cancelled = true;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function stopScanner() {
    const s = scannerRef.current;
    scannerRef.current = null;
    setRunning(false);
    if (!s) return;
    try {
      await s.stop();
      s.clear();
    } catch {
      /* already stopped */
    }
  }

  return (
    <div className="space-y-3">
      <div
        id={regionId}
        className="overflow-hidden rounded-xl border border-white/20 bg-black/40 min-h-[240px]"
      />
      {starting && (
        <p className="flex items-center justify-center gap-2 text-sm text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" /> Starting camera…
        </p>
      )}
      {error && (
        <p className="text-sm text-amber-300 flex items-center gap-2">
          <CameraOff className="h-4 w-4" />
          {error}
        </p>
      )}
      {running && (
        <p className="text-xs text-center text-white/50 flex items-center justify-center gap-1">
          <Camera className="h-3 w-3" /> Point camera at product QR label
        </p>
      )}
      {running && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-white/20 text-white hover:bg-white/10"
          onClick={() => stopScanner()}
        >
          Stop Camera
        </Button>
      )}
    </div>
  );
}
