"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Palette, Image, Type, BookOpen, FolderOpen, LayoutTemplate,
  Package, Mail, Monitor, GitBranch, ShieldAlert, BarChart3,
  Wand2, ArrowRight, Building2, Layers,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { BRAND_LIFECYCLE } from "@/lib/branding";

const MODULES = [
  { title: "Brand Profiles", href: "/dashboard/branding/profiles", icon: Building2, desc: "Multi-company identity" },
  { title: "Logos", href: "/dashboard/branding/logos", icon: Image, desc: "Primary · dark · watermark" },
  { title: "Colors", href: "/dashboard/branding/colors", icon: Palette, desc: "HEX · CMYK · contrast" },
  { title: "Typography", href: "/dashboard/branding/typography", icon: Type, desc: "Heading · body · print fonts" },
  { title: "Guidelines", href: "/dashboard/branding/guidelines", icon: BookOpen, desc: "Digital brand book" },
  { title: "Asset Library", href: "/dashboard/branding/assets", icon: FolderOpen, desc: "DAM · tags · versions" },
  { title: "Templates", href: "/dashboard/branding/templates", icon: LayoutTemplate, desc: "Invoice · PO · labels" },
  { title: "Designer", href: "/dashboard/branding/designer", icon: Layers, desc: "Layout canvas preview" },
  { title: "Product Branding", href: "/dashboard/branding/products", icon: Package, desc: "Packaging · QR · security" },
  { title: "Email Branding", href: "/dashboard/branding/email", icon: Mail, desc: "Signatures · newsletters" },
  { title: "UI Themes", href: "/dashboard/branding/themes", icon: Monitor, desc: "ERP look & login" },
  { title: "Approvals", href: "/dashboard/branding/approvals", icon: GitBranch, desc: "Marketing → Brand → Mgmt" },
  { title: "Compliance", href: "/dashboard/branding/compliance", icon: ShieldAlert, desc: "Violations · scans" },
  { title: "Analytics", href: "/dashboard/branding/analytics", icon: BarChart3, desc: "Assets · downloads · usage" },
  { title: "AI Assistant", href: "/dashboard/branding/ai", icon: Wand2, desc: "Copy · design · compliance" },
];

export default function BrandingHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    brands: 0,
    assets: 0,
    templates: 0,
    pending: 0,
    issues: 0,
    colors: 0,
    products: 0,
  });
  const [brand, setBrand] = useState<Record<string, unknown> | null>(null);
  const [swatches, setSwatches] = useState<Array<{ name: string; hex_value: string }>>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [
        brands, assets, templates, pending, issues, colors, products,
        { data: primary }, { data: colorRows },
      ] = await Promise.all([
        supabase.from("brand_profiles").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("brand_assets").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("brand_templates").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("brand_approvals").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("brand_compliance_issues").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("brand_colors").select("*", { count: "exact", head: true }),
        supabase.from("brand_product_profiles").select("*", { count: "exact", head: true }),
        supabase.from("brand_profiles").select("*").eq("is_primary", true).is("deleted_at", null).limit(1).maybeSingle(),
        supabase.from("brand_colors").select("name,hex_value").order("sort_order").limit(6),
      ]);
      setStats({
        brands: brands.count ?? 0,
        assets: assets.count ?? 0,
        templates: templates.count ?? 0,
        pending: pending.count ?? 0,
        issues: issues.count ?? 0,
        colors: colors.count ?? 0,
        products: products.count ?? 0,
      });
      setBrand(primary as Record<string, unknown> | null);
      setSwatches((colorRows as typeof swatches) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading brand platform…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Branding & Identity"
        description="Multi-company brands · DAM · templates · compliance · AI design"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings/branding">Legacy settings</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/branding/assets">Asset library</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {BRAND_LIFECYCLE.map((s) => (
          <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
        ))}
      </div>

      {brand && (
        <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Primary brand</p>
              <h2 className="text-xl font-semibold">{String(brand.brand_name)}</h2>
              <p className="text-sm text-muted-foreground">
                {String(brand.trading_name || "")} · {String(brand.website || "")}
              </p>
            </div>
            <div className="flex gap-2">
              {swatches.map((c) => (
                <div key={c.hex_value + c.name} className="text-center">
                  <div
                    className="h-10 w-10 rounded-md border shadow-sm"
                    style={{ backgroundColor: c.hex_value }}
                    title={c.name}
                  />
                  <div className="text-[9px] mt-0.5 font-mono">{c.hex_value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Brand profiles" value={String(stats.brands)} icon={Building2} />
        <StatCard title="Assets" value={String(stats.assets)} icon={FolderOpen} />
        <StatCard title="Templates" value={String(stats.templates)} icon={LayoutTemplate} />
        <StatCard title="Pending approvals" value={String(stats.pending)} icon={GitBranch} />
        <StatCard title="Open issues" value={String(stats.issues)} icon={ShieldAlert} />
        <StatCard title="Colors" value={String(stats.colors)} icon={Palette} />
        <StatCard title="Product brands" value={String(stats.products)} icon={Package} />
        <StatCard title="Modules" value={String(MODULES.length)} icon={Layers} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <m.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{m.title}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
