"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { LabelData } from "@/lib/labels";
import { labelVerifyHint } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function LabelCard({
  label,
  appUrl = "https://hope-securetrack.vercel.app",
  className,
  size = "ream",
}: {
  label: LabelData;
  appUrl?: string;
  className?: string;
  size?: "ream" | "carton";
}) {
  const [qrSrc, setQrSrc] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(label.qrData, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size === "carton" ? 160 : 120,
      color: { dark: "#0B1F3A", light: "#FFFFFF" },
    }).then((url) => {
      if (!cancelled) setQrSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [label.qrData, size]);

  return (
    <div
      className={cn(
        "label-card border-2 border-hope-navy bg-white text-hope-navy break-inside-avoid",
        size === "carton" ? "w-[70mm] min-h-[50mm] p-2" : "w-[50mm] min-h-[30mm] p-1.5",
        className
      )}
      data-serial={label.serial}
    >
      <div className="flex gap-1.5 h-full">
        <div className="flex flex-col items-center justify-center shrink-0">
          {qrSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrSrc}
              alt={`QR ${label.serial}`}
              className={size === "carton" ? "w-[28mm] h-[28mm]" : "w-[18mm] h-[18mm]"}
            />
          ) : (
            <div
              className={
                size === "carton"
                  ? "w-[28mm] h-[28mm] bg-muted animate-pulse"
                  : "w-[18mm] h-[18mm] bg-muted animate-pulse"
              }
            />
          )}
        </div>
        <div className="flex flex-col justify-between min-w-0 flex-1 py-0.5">
          <div>
            <p className="text-[7px] font-bold tracking-wide text-hope-teal uppercase leading-tight">
              SecureTrack ERP
            </p>
            <p className="font-mono font-bold text-[9px] leading-tight truncate mt-0.5">
              {label.serial}
            </p>
            <p className="text-[7px] leading-tight truncate mt-0.5">
              {label.productName || label.productCode || "Paper Product"}
            </p>
            <p className="text-[7px] text-slate-600 leading-tight">
              {[label.paperSize, label.gsm ? `${label.gsm}gsm` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {label.batchNumber && (
              <p className="text-[6px] text-slate-500 font-mono truncate">
                Batch {label.batchNumber}
              </p>
            )}
          </div>
          <div className="border-t border-hope-gold/40 pt-0.5 mt-0.5">
            <p className="text-[5.5px] text-slate-500 leading-tight">
              {labelVerifyHint(appUrl)}
            </p>
            <p className="text-[5px] text-slate-400 font-mono truncate">
              {label.publicUuid.slice(0, 13)}…
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
