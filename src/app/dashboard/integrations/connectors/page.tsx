"use client";

import { useEffect, useState } from "react";
import { Store, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

export default function ConnectorsMarketplacePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("intg_connectors").select("*").eq("is_active", true).order("category");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const install = async (c: Record<string, unknown>) => {
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const code = `${c.connector_code}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
      const crudRes = await crudCreate("intg_connections", {
        company_id: auth.profile.company_id,
        connector_id: c.id,
        connection_code: code,
        name: `${c.name} connection`,
        environment: "sandbox",
        status: "draft",
        base_url: null,
        is_enabled: false,
        created_by: auth.profile.id,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success(`Installed ${c.name} — configure under Connections`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Install failed");
    }
  };

  if (loading) return <LoadingState message="Loading connector marketplace…" />;

  const cats = Array.from(new Set(rows.map((r) => String(r.category))));
  const filtered = rows.filter((r) => {
    if (cat !== "all" && r.category !== cat) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      String(r.name).toLowerCase().includes(s) ||
      String(r.connector_code).toLowerCase().includes(s) ||
      String(r.provider || "").toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <PageHeader
        title="Connector Marketplace"
        description="Payment · banking · communication · cloud · identity · IoT · hardware · government · AI"
      />
      <div className="flex flex-wrap gap-2 mb-4">
        <Input className="max-w-xs" placeholder="Search connectors…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant={cat === "all" ? "default" : "outline"} onClick={() => setCat("all")}>All</Button>
          {cats.map((c) => (
            <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)}>{c}</Button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <Card key={String(c.id)}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="h-4 w-4 text-teal-700" /> {String(c.name)}
                </CardTitle>
                {c.is_system ? <Badge variant="secondary">System</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground text-xs">{String(c.description || "—")}</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline">{String(c.category)}</Badge>
                <Badge variant="outline">{String(c.protocol)}</Badge>
                <Badge variant="outline">{String(c.auth_type)}</Badge>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">{String(c.connector_code)} · {String(c.provider)}</p>
              <Button size="sm" onClick={() => install(c)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Install
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
