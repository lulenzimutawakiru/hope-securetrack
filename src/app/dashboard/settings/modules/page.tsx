"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Blocks } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudUpdate } from "@/lib/api/crud-client";

export default function ModulesSettingsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("erp_modules")
      .select("*")
      .order("sort_order");
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (id: string, field: "is_enabled" | "is_licensed", value: boolean) => {
    if (!auth) return;
    const supabase = createClient();
    const crudRes = await crudUpdate("erp_modules", id, { [field]: !value, updated_at: new Date().toISOString() });
    if (!crudRes.ok) {
      toast.error(crudRes.error);
      return;
    }
    await supabase.from("config_change_log").insert({
      company_id: auth.profile.company_id,
      entity_type: "erp_module",
      entity_id: id,
      action: "toggle",
      field_name: field,
      old_value: String(value),
      new_value: String(!value),
      changed_by: auth.profile.id,
    });
    toast.success("Module updated");
    load();
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="ERP Module Management"
        description="Enable or disable modules · licensing · feature flags"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/settings">Hub</Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Blocks} title="No modules registered" description="Run settings migration seeds" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Licensed</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="text-muted-foreground">{String(r.sort_order)}</TableCell>
                  <TableCell className="font-mono text-sm">{String(r.module_key)}</TableCell>
                  <TableCell>{String(r.module_name)}</TableCell>
                  <TableCell>
                    {r.is_enabled ? (
                      <Badge className="bg-green-100 text-green-800">On</Badge>
                    ) : (
                      <Badge variant="secondary">Off</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.is_licensed ? (
                      <Badge variant="outline">Licensed</Badge>
                    ) : (
                      <Badge variant="secondary">Unlicensed</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggle(String(r.id), "is_enabled", Boolean(r.is_enabled))}
                    >
                      {r.is_enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggle(String(r.id), "is_licensed", Boolean(r.is_licensed))}
                    >
                      License
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
