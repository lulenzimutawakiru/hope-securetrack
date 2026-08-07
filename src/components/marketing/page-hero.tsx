import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHero({
  eyebrow,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-muted/30">
      <div
        className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.14),transparent_45%),radial-gradient(circle_at_80%_10%,hsl(var(--accent)/0.12),transparent_40%)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28 lg:px-8">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h1 className="max-w-3xl text-balance text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{subtitle}</p>
        ) : null}
        {(primaryCta || secondaryCta) && (
          <div className="mt-8 flex flex-wrap gap-3">
            {primaryCta ? (
              <Button asChild size="lg">
                <Link href={primaryCta.href}>
                  {primaryCta.label} <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
            {secondaryCta ? (
              <Button asChild size="lg" variant="outline">
                <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
              </Button>
            ) : null}
          </div>
        )}
        {children ? <div className="mt-10">{children}</div> : null}
      </div>
    </section>
  );
}