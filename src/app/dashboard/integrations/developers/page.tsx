"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Download, Key } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function DevelopersPage() {
  const [routes, setRoutes] = useState<Array<Record<string, unknown>>>([]);
  const [sdks, setSdks] = useState<Array<Record<string, unknown>>>([]);
  const [apps, setApps] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [r, s, a] = await Promise.all([
        supabase.from("intg_api_routes").select("*").order("path_pattern"),
        supabase.from("intg_sdk_downloads").select("*"),
        supabase.from("intg_api_apps").select("*"),
      ]);
      setRoutes(r.data ?? []);
      setSdks(s.data ?? []);
      setApps(a.data ?? []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const downloadSdk = async (id: string, name: string) => {
    const supabase = createClient();
    const { data } = await supabase.from("intg_sdk_downloads").select("download_count").eq("id", id).single();
    await supabase
      .from("intg_sdk_downloads")
      .update({ download_count: (data?.download_count || 0) + 1 })
      .eq("id", id);
    toast.success(`SDK ${name} download counted`);
    const { data: s } = await supabase.from("intg_sdk_downloads").select("*");
    setSdks(s ?? []);
  };

  if (loading) return <LoadingState message="Loading developer portal…" />;

  return (
    <div>
      <PageHeader
        title="Developer Portal"
        description="API docs · explorer · sandbox · keys · SDKs · webhooks"
        actions={
          <Button asChild size="sm">
            <Link href="/dashboard/integrations/api"><Key className="h-4 w-4 mr-1" /> API keys</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> API reference (v1)
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Auth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((r) => (
                  <TableRow key={String(r.id)}>
                    <TableCell><Badge variant="outline">{String(r.method)}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{String(r.path_pattern)}</TableCell>
                    <TableCell className="text-xs">{String(r.target_module)}</TableCell>
                    <TableCell className="text-xs">{r.is_public ? "Public" : "API key / JWT"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Sandbox apps</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {apps.filter((a) => a.environment === "sandbox").map((a) => (
              <div key={String(a.id)} className="rounded border p-2">
                <div className="font-medium">{String(a.name)}</div>
                <div className="text-xs font-mono text-muted-foreground">{String(a.app_code)}</div>
                <div className="text-xs">Rate: {String(a.rate_limit_per_min)}/min</div>
              </div>
            ))}
            {apps.filter((a) => a.environment === "sandbox").length === 0 && (
              <p className="text-muted-foreground text-xs">Register a sandbox app under API Gateway.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <h3 className="text-sm font-semibold mb-2">SDK downloads</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {sdks.map((s) => (
          <Card key={String(s.id)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{String(s.sdk_name)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Badge variant="outline">{String(s.language)}</Badge>
              <Badge variant="secondary">v{String(s.version)}</Badge>
              <p className="text-xs text-muted-foreground">Downloads: {String(s.download_count)}</p>
              <Button size="sm" variant="outline" onClick={() => downloadSdk(String(s.id), String(s.sdk_name))}>
                <Download className="h-3.5 w-3.5 mr-1" /> Get SDK
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
