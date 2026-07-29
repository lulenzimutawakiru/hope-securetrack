"use client";

import { useEffect, useState } from "react";
import {
  BarChart3, FolderOpen, LayoutTemplate, Download, GitBranch, ShieldAlert, Package, Palette,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

export default function BrandAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    assets: 0,
    templates: 0,
    published: 0,
    pending: 0,
    issues: 0,
    downloads: 0,
    products: 0,
    colors: 0,
    logos: 0,
  });
  const [topAssets, setTopAssets] = useState<Array<Record<string, unknown>>>([]);
  const [expiring, setExpiring] = useState<Array<Record<string, unknown>>>([]);
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [
        assets, templates, published, pending, issues, products, colors, logos,
        { data: assetRows }, { data: expRows }, { data: auditRows },
      ] = await Promise.all([
        sb.from("brand_assets").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("brand_templates").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("brand_templates").select("*", { count: "exact", head: true }).eq("status", "published"),
        sb.from("brand_approvals").select("*", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("brand_compliance_issues").select("*", { count: "exact", head: true }).eq("status", "open"),
        sb.from("brand_product_profiles").select("*", { count: "exact", head: true }),
        sb.from("brand_colors").select("*", { count: "exact", head: true }),
        sb.from("brand_logos").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("brand_assets").select("title,download_count,asset_type,asset_code").is("deleted_at", null).order("download_count", { ascending: false }).limit(8),
        sb.from("brand_assets").select("title,expires_on,status").is("deleted_at", null).not("expires_on", "is", null).order("expires_on").limit(8),
        sb.from("brand_audit").select("*").order("created_at", { ascending: false }).limit(12),
      ]);

      const downloads = ((assetRows as Array<{ download_count?: number }>) || []).reduce(
        (s, a) => s + (a.download_count || 0),
        0
      );

      setStats({
        assets: assets.count ?? 0,
        templates: templates.count ?? 0,
        published: published.count ?? 0,
        pending: pending.count ?? 0,
        issues: issues.count ?? 0,
        downloads,
        products: products.count ?? 0,
        colors: colors.count ?? 0,
        logos: logos.count ?? 0,
      });
      setTopAssets((assetRows as Array<Record<string, unknown>>) || []);
      setExpiring((expRows as Array<Record<string, unknown>>) || []);
      setAudit((auditRows as Array<Record<string, unknown>>) || []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading brand analytics…" />;

  return (
    <div>
      <PageHeader
        title="Brand Analytics"
        description="Assets · templates · downloads · approvals · violations · expiry"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Assets" value={String(stats.assets)} icon={FolderOpen} />
        <StatCard title="Templates" value={String(stats.templates)} icon={LayoutTemplate} />
        <StatCard title="Published" value={String(stats.published)} icon={LayoutTemplate} />
        <StatCard title="Downloads" value={String(stats.downloads)} icon={Download} />
        <StatCard title="Pending approvals" value={String(stats.pending)} icon={GitBranch} />
        <StatCard title="Open violations" value={String(stats.issues)} icon={ShieldAlert} />
        <StatCard title="Product brands" value={String(stats.products)} icon={Package} />
        <StatCard title="Colors / logos" value={`${stats.colors} / ${stats.logos}`} icon={Palette} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Most used assets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topAssets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No download data yet</p>
            ) : (
              topAssets.map((a) => (
                <div key={String(a.asset_code)} className="flex justify-between text-sm border-b pb-1">
                  <span className="truncate mr-2">{String(a.title)}</span>
                  <span className="text-muted-foreground shrink-0">{String(a.download_count ?? 0)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expiring assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {expiring.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expiry dates set</p>
            ) : (
              expiring.map((a, i) => (
                <div key={i} className="flex justify-between text-sm border-b pb-1">
                  <span className="truncate mr-2">{String(a.title)}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {a.expires_on ? formatDate(String(a.expires_on)) : "—"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent audit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit events</p>
            ) : (
              audit.map((a) => (
                <div key={String(a.id)} className="text-xs border-b pb-1">
                  <span className="font-medium">{String(a.action)}</span>
                  {a.entity_type ? (
                    <span className="text-muted-foreground"> · {String(a.entity_type)}</span>
                  ) : null}
                  <div className="text-muted-foreground">
                    {a.created_at ? formatDate(String(a.created_at)) : ""}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
