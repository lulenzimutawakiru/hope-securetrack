"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutTemplate, Copy, Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";
import { softDelete } from "@/lib/soft-delete";
import type { WidTemplate } from "@/lib/workforce-id";

export default function TemplatesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<WidTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("wid_card_templates")
      .select("*")
      .is("deleted_at", null)
      .order("category");
    setRows((data as WidTemplate[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const clone = async (t: WidTemplate) => {
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      const code = `${t.template_code}-COPY-${Date.now().toString(36).toUpperCase().slice(-4)}`;
      const crudRes = await crudCreate("wid_card_templates", {
        company_id: auth.profile.company_id,
        brand_id: t.brand_id,
        template_code: code,
        name: `${t.name} (Copy)`,
        description: t.description,
        category: t.category,
        card_format: t.card_format,
        orientation: t.orientation,
        width_mm: t.width_mm,
        height_mm: t.height_mm,
        sides: t.sides,
        design_json: t.design_json,
        security_features: t.security_features,
        default_access_profile_code: t.default_access_profile_code,
        language: t.language,
        version: 1,
        is_system: false,
        cloned_from: t.id,
        created_by: auth.profile.id,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Template cloned");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clone failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Archive this template?")) return;
    try {
      const supabase = createClient();
      await softDelete(supabase, "wid_card_templates", id);
      toast.success("Template archived");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (loading) return <LoadingState message="Loading templates…" />;

  return (
    <div>
      <PageHeader
        title="Card Templates"
        description="Executive · factory · security · visitor · unlimited custom templates"
        actions={
          <Button asChild size="sm">
            <Link href="/dashboard/credentials/designer">
              <Plus className="h-4 w-4 mr-1" /> Open Designer
            </Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No templates" description="Run migration seed or create in Design Studio." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <LayoutTemplate className="h-5 w-5 text-teal-700" />
                    <CardTitle className="text-base">{t.name}</CardTitle>
                  </div>
                  {t.is_system && <Badge variant="secondary">System</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{t.description || "—"}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{t.category}</Badge>
                  <Badge variant="outline">{t.card_format}</Badge>
                  <Badge variant="outline">v{t.version}</Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">{t.template_code}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(t.security_features || []).map((f) => (
                    <Badge key={f} className="text-[10px]" variant="secondary">{f}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Access: {t.default_access_profile_code || "—"} ·{" "}
                  {(t.design_json?.front || []).length} front / {(t.design_json?.back || []).length} back elements
                </p>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/credentials/designer`}>Edit</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => clone(t)}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Clone
                  </Button>
                  {!t.is_system && (
                    <Button size="sm" variant="ghost" onClick={() => remove(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
