import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { Section } from "./section";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="border-b border-border/60 bg-hope-indigo">
          <div className="mx-auto w-full max-w-4xl px-4 pb-12 pt-16 sm:px-6 sm:pt-20 lg:px-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-hope-sky">Legal</p>
            <h1 className="font-jakarta text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{title}</h1>
            <p className="mt-3 text-sm text-white/80">Last updated: {updated}</p>
          </div>
        </section>
        <Section>
          <div className="mx-auto max-w-4xl space-y-10">{children}</div>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}

export function LegalBlock({ heading, paragraphs }: { heading: string; paragraphs: ReactNode[] }) {
  return (
    <div>
      <h2 className="text-xl font-bold">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}
