"use client";

import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/crud-compat";

export default function AuditCompliancePage() {
  const [loading, setLoading] = useState(true);
  const [frameworks, setFrameworks] = useState<Array<Record<string, unknown>>>([]);
  const [controls, setControls] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [{ data: fw }, { data: ct }] = await Promise.all([
        sb.from("eal_frameworks").select("*").eq("is_active", true).order("code"),
        sb.from("eal_controls").select("*").order("control_code"),
      ]);
      setFrameworks((fw as Array<Record<string, unknown>>) || []);
      setControls((ct as Array<Record<string, unknown>>) || []);
      if (fw?.[0]) setSelected(String(fw[0].id));
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading compliance frameworks…" />;

  const filtered = selected
    ? controls.filter((c) => String(c.framework_id) === selected)
    : controls;

  const statusCounts = {
    implemented: filtered.filter((c) => c.status === "implemented").length,
    partial: filtered.filter((c) => c.status === "partial").length,
    planned: filtered.filter((c) => c.status === "planned").length,
  };

  return (
    <div>
      <PageHeader
        title="Compliance Management"
        description="ISO 27001 · ISO 9001 · SOC 2 · GDPR · Uganda DPA · financial audit evidence"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {frameworks.map((f) => (
          <Card
            key={String(f.id)}
            className={`cursor-pointer transition ${selected === f.id ? "border-primary" : ""}`}
            onClick={() => setSelected(String(f.id))}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                {String(f.code)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-sm">{String(f.name)}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{String(f.description || "")}</p>
              <Badge variant="outline" className="text-[10px] mt-2">{String(f.region || "Global")}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {frameworks.length === 0 && (
        <EmptyState title="No frameworks" description="Apply migration 00039 to seed compliance frameworks." />
      )}

      {selected && (
        <>
          <div className="flex gap-3 mb-4 text-sm">
            <Badge variant="default">Implemented {statusCounts.implemented}</Badge>
            <Badge variant="secondary">Partial {statusCounts.partial}</Badge>
            <Badge variant="outline">Planned {statusCounts.planned}</Badge>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Control</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={String(c.id)}>
                    <TableCell className="font-mono text-xs">{String(c.control_code)}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{String(c.title)}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{String(c.description || "")}</p>
                    </TableCell>
                    <TableCell className="text-xs">{String(c.category || "—")}</TableCell>
                    <TableCell>
                      <Badge
                        variant={c.status === "implemented" ? "default" : "outline"}
                        className="text-[10px] capitalize"
                      >
                        {String(c.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{String(c.owner_name || "—")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
