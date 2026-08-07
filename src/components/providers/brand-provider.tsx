"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import {
  defaultBrand,
  resolveCompanyBranding,
  type ResolvedBrand,
} from "@/lib/branding/resolve";

/**
 * Single-flight + short-TTL memo: concurrent and repeated brand loads for the
 * same company share one request. React Strict Mode double-mounts effects and
 * shell remounts would otherwise refetch branding on every app boot.
 * Keyed by company id only (UUID, globally unique per tenant) so no cross-tenant
 * data can ever be served - the fetch still runs through the caller's session.
 */
const brandCache = new Map<
  string,
  { promise: Promise<ResolvedBrand>; at: number }
>();
const BRAND_TTL_MS = 60_000;

function resolveBrandCached(companyId: string): Promise<ResolvedBrand> {
  const hit = brandCache.get(companyId);
  if (hit && Date.now() - hit.at < BRAND_TTL_MS) return hit.promise;
  const promise = resolveCompanyBranding(createClient(), companyId);
  brandCache.set(companyId, { promise, at: Date.now() });
  return promise;
}

interface BrandContextValue {
  brand: ResolvedBrand;
  loading: boolean;
}

const BrandContext = createContext<BrandContextValue | null>(null);

/** Hex (#RRGGBB) to the HSL triplet format used by globals.css tokens ("H S% L%"). */
function hexToHslTriplet(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return "";
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Relative luminance (0..1) of a hex color, used to pick a readable foreground. */
function hexLuminance(hex: string): number {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return 0;
  const channel = (i: number) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

const DEFAULTS = {
  primary: "213 68% 9%",
  accent: "183 80% 26%",
  brand: "45 70% 47%",
  ring: "183 80% 26%",
  darkForeground: "222 47% 11%",
  lightForeground: "0 0% 100%",
};

/**
 * Resolves the active company's brand (name, logo, colors) and exposes it to
 * the app chrome via useBrand(). The brand palette is applied as CSS custom
 * properties so Tailwind tokens (bg-primary, text-accent, ...) reflect the
 * tenant's colors live.
 *
 * Platform staff (no company context) keep the platform default brand. The
 * high-contrast accessibility mode is never overridden.
 */
export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { companyId } = useUser();
  const [brand, setBrand] = useState<ResolvedBrand>(() => defaultBrand(null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!companyId) {
        if (!cancelled) {
          setBrand(defaultBrand(null));
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const resolved = await resolveBrandCached(companyId);
      if (!cancelled) {
        setBrand(resolved);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains("high-contrast")) return;

    const primary = hexToHslTriplet(brand.primaryColor);
    const accent = hexToHslTriplet(brand.accentColor);
    const secondary = hexToHslTriplet(brand.secondaryColor);

    root.style.setProperty("--primary", primary || DEFAULTS.primary);
    root.style.setProperty(
      "--primary-foreground",
      brand.primaryColor && hexLuminance(brand.primaryColor) > 0.5
        ? DEFAULTS.darkForeground
        : DEFAULTS.lightForeground
    );
    root.style.setProperty("--accent", accent || DEFAULTS.accent);
    root.style.setProperty(
      "--accent-foreground",
      brand.accentColor && hexLuminance(brand.accentColor) > 0.5
        ? DEFAULTS.darkForeground
        : DEFAULTS.lightForeground
    );
    root.style.setProperty("--ring", accent || DEFAULTS.ring);
    root.style.setProperty("--brand", secondary || DEFAULTS.brand);
    root.style.setProperty("--sidebar-primary", secondary || DEFAULTS.brand);
    root.style.setProperty("--sidebar-ring", secondary || DEFAULTS.brand);
  }, [brand]);

  const value = useMemo<BrandContextValue>(
    () => ({ brand, loading }),
    [brand, loading]
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    throw new Error("useBrand must be used within a <BrandProvider>");
  }
  return ctx;
}