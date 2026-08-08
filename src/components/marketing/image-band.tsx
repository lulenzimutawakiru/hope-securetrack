import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Full-width advertising image band used across marketing pages.
 * Renders a responsive, rounded, cover-cropped photo with an optional
 * overlay caption using next/image (optimized + lazy loaded).
 */
export function ImageBand({
  src,
  alt,
  kicker,
  caption,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  kicker?: string;
  caption?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <section className={cn("relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-border/60 shadow-2xl sm:aspect-[21/9]">
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 1216px, 100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent"
          aria-hidden="true"
        />
        {(kicker || caption) ? (
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
            {kicker ? (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-hope-sky">{kicker}</p>
            ) : null}
            {caption ? (
              <p className="mt-1 max-w-2xl text-balance text-xl font-bold text-white sm:text-2xl">{caption}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
