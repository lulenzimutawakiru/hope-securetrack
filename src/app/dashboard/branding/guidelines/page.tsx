"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

const SECTIONS = [
  { value: "logo", label: "Logo Guidelines" },
  { value: "color", label: "Color Guidelines" },
  { value: "typography", label: "Typography Rules" },
  { value: "photography", label: "Photography Style" },
  { value: "communication", label: "Communication Style" },
  { value: "forbidden", label: "Forbidden Usage" },
  { value: "custom", label: "Custom Section" },
];

export default function BrandGuidelinesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    section_code: "logo",
    title: "",
    body: "",
    status: "draft",
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("brand_guidelines")
      .select("*")
      .order("sort_order");
    setRows((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const { error } = await createClient().from("brand_guidelines").insert({
        company_id: companyId,
        section_code: form.section_code,
        title: form.title || SECTIONS.find((s) => s.value === form.section_code)?.label || form.section_code,
        body: form.body,
        status: form.status,
        version: 1,
        sort_order: rows.length + 1,
        published_at: form.status === "published" ? new Date().toISOString() : null,
        created_by: auth?.user?.id,
      });
      if (error) throw error;
      toast.success("Guideline section saved");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading brand book…" />;

  return (
    <div>
      <PageHeader
        title="Brand Guidelines"
        description="Digital brand book · logo · color · type · photo · voice · forbidden"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New section</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <form onSubmit={create}>
                <DialogHeader><DialogTitle>Add brand book section</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Section</Label>
                    <Select value={form.section_code} onValueChange={(v) => setForm((f) => ({ ...f, section_code: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SECTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Optional override title" />
                  </div>
                  <div>
                    <Label>Body (markdown)</Label>
                    <Textarea rows={8} required value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button type="submit">Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={BookOpen} title="No guidelines" description="Publish logo, color, and communication rules." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            {rows.map((g) => (
              <button
                key={String(g.id)}
                type="button"
                onClick={() => setSelected(g)}
                className={`w-full text-left rounded-md border p-3 hover:bg-muted/50 transition ${
                  selected?.id === g.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{String(g.title)}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{String(g.status)}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {String(g.section_code)} · v{String(g.version ?? 1)}
                </p>
              </button>
            ))}
          </div>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{selected ? String(selected.title) : "Select a section"}</CardTitle>
            </CardHeader>
            <CardContent>
              {selected ? (
                <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-muted-foreground">
                  {String(selected.body)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">Choose a brand book section to read usage rules.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
