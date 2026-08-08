import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * SecureTrack ERP logo mark: a secure shield carrying a routed checkmark
 * (the "track"), finished with gold route-node accents. Uses an instance-
 * scoped gradient id so multiple marks on one page never collide.
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  const grad = `stg-${id.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={grad} x1="7" y1="3" x2="41" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00538C" />
          <stop offset="0.55" stopColor="#0064D8" />
          <stop offset="1" stopColor="#1B90FF" />
        </linearGradient>
      </defs>
      <path
        d="M24 3 40.5 9.5 38.6 22.6C37.9 32.5 32 40.2 24 44.4 16 40.2 10.1 32.5 9.4 22.6L7.5 9.5 24 3Z"
        fill={`url(#${grad})`}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d="M15.6 24.6 21.2 30.2 32.6 18.2"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15.6" cy="24.6" r="2.1" fill="#F0AB00" />
      <circle cx="32.6" cy="18.2" r="2.1" fill="#F0AB00" />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  showWordmark = true,
  light = false,
}: {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  light?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn("h-9 w-9 drop-shadow-sm", markClassName)} />
      {showWordmark ? (
        <span className={cn("text-[15px] font-bold tracking-tight", light ? "text-white" : "text-foreground")}>
          SecureTrack<span className={light ? "text-[#A6DAFB]" : "text-primary"}> ERP</span>
        </span>
      ) : null}
    </span>
  );
}
