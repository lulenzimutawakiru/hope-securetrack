"use client";

import { useEffect, useState } from "react";
import { Network } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { INTERNAL_MODULES } from "@/lib/integration";

export default function ModuleLinksPage() {
  const [links, setLinks] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("intg_module_links").select("*").order("source_module");
      setLinks(data ?? []);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading ERP mesh…" />;

  return (
    <div>
      <PageHeader
        title="Internal ERP Integrations"
        description="HR · IAM · CRM · Sales · Procurement · Inventory · Production · Finance · Billing · Help Desk · Projects"
      />
      <div className="flex flex-wrap gap-1.5 mb-6">
        {INTERNAL_MODULES.map((m) => (
          <Badge key={m} variant="outline">{m}</Badge>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Card key={String(l.id)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Network className="h-4 w-4 text-teal-700" />
                {String(l.source_module)} → {String(l.target_module)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              <Badge variant="secondary">{String(l.link_type)}</Badge>
              <p className="font-mono">{String(l.event_key)}</p>
              <p className="text-muted-foreground">{String(l.description || "—")}</p>
              <p>{l.is_active ? "Active" : "Disabled"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {links.length === 0 && (
        <p className="text-sm text-muted-foreground">Run migration seed for module event mesh.</p>
      )}
    </div>
  );
}
