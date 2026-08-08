import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Browser-chrome frame around a real SecureTrack ERP screenshot.
 * Screenshots live in public/screenshots and are served/optimized by next/image.
 */
export function ScreenshotFrame({
  src,
  alt,
  title,
  badge = "Live",
  className,
  imageClassName,
  priority = false,
}: {
  src: string;
  alt: string;
  title?: string;
  badge?: string | null;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/40 ring-1 ring-white/5 backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
        </div>
        {title ? (
          <span className="truncate text-xs font-medium text-white/55">{title}</span>
        ) : (
          <span className="w-8" aria-hidden="true" />
        )}
        {badge ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
            {badge}
          </span>
        ) : (
          <span className="w-14" aria-hidden="true" />
        )}
      </div>
      <div className={cn("relative aspect-[8/5] w-full bg-white dark:bg-slate-800/60", imageClassName)}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 1180px, 100vw"
          className="object-cover"
        />
      </div>
    </div>
  );
}