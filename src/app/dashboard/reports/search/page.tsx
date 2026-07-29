"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";

const ENTITY_FILTERS = [
  "all",
  "report",
  "document",
  "invoice",
  "employee",
  "supplier",
  "batch",
  "po",
  "contract",
  "asset",
  "kpi",
  "dashboard",
];

export default function EnterpriseSearchPage() {
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("all");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const runSearch = async (term: string, type: string) => {
    setSearching(true);
    const supabase = createClient();
    let query = supabase
      .from("bi_search_index")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (type !== "all") query = query.eq("entity_type", type);

    if (term.trim()) {
      // Prefer full-text; fallback to ilike if fts returns empty
      const fts = await supabase
        .from("bi_search_index")
        .select("*")
        .textSearch("search_vector", term.trim().split(/\s+/).join(" & "), {
          type: "plain",
          config: "english",
        })
        .limit(50);
      if (!fts.error && fts.data && fts.data.length > 0) {
        let data = fts.data;
        if (type !== "all") {
          data = data.filter((r) => r.entity_type === type);
        }
        setRows(data);
        setSearching(false);
        setLoading(false);
        return;
      }
      query = query.or(
        `title.ilike.%${term}%,subtitle.ilike.%${term}%,body_text.ilike.%${term}%`
      );
    }

    const { data } = await query;
    setRows(data ?? []);
    setSearching(false);
    setLoading(false);
  };

  useEffect(() => {
    runSearch("", "all");
  }, []);

  if (loading) return <LoadingState message="Loading enterprise search…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Search"
        description="Global search — invoices · employees · suppliers · batches · POs · contracts · reports · documents · KPIs"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/reports">Hub</Link>
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder='Search e.g. "board", "supplier", "trial balance"…'
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch(q, entity);
            }}
          />
        </div>
        <Button onClick={() => runSearch(q, entity)} disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 mb-6">
        {ENTITY_FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={entity === f ? "default" : "outline"}
            className="capitalize"
            onClick={() => {
              setEntity(f);
              runSearch(q, f);
            }}
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches.</p>
        ) : (
          rows.map((r) => (
            <Link key={String(r.id)} href={String(r.href || "/dashboard/reports")}>
              <Card className="hover:border-hope-teal transition-colors mb-2">
                <CardContent className="py-3 flex flex-wrap items-start gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {String(r.entity_type)}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {String(r.classification)}
                  </Badge>
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm font-medium">{String(r.title)}</p>
                    <p className="text-xs text-muted-foreground">
                      {String(r.subtitle ?? "")}
                      {r.body_text ? ` — ${String(r.body_text).slice(0, 100)}` : ""}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{String(r.module_key)}</span>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
