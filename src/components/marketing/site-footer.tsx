import Link from "next/link";
import { Shield } from "lucide-react";
import { COMPANY, FOOTER_LINKS } from "@/lib/marketing/data";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-2.5" aria-label="SecureTrack ERP home">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Shield className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-[15px] font-bold tracking-tight">
                SecureTrack<span className="text-primary"> ERP</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {COMPANY.tagline} {COMPANY.description}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">{COMPANY.address}</p>
            <p className="mt-1 text-sm text-muted-foreground">{COMPANY.email}</p>
          </div>
          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold">{group.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {year} {COMPANY.legalName}. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            AI-powered · Cloud-native · Multi-tenant · Enterprise ready
          </p>
        </div>
      </div>
    </footer>
  );
}