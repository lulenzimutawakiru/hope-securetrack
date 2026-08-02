"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

export default function HopeChatKnowledgePage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", category: "guides" });

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("hc_knowledge")
      .select("*")
      .eq("status", "published")
      .order("updated_at", { ascending: false });
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
      const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
      const crudRes = await crudCreate("hc_knowledge", {
        company_id: companyId,
        title: form.title,
        slug,
        body: form.body,
        category: form.category,
        status: "published",
        author_id: userId,
      });
      if (!crudRes.ok) throw new Error(crudRes.error);
      toast.success("Article published");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      String(r.title).toLowerCase().includes(s) ||
      String(r.body).toLowerCase().includes(s) ||
      String(r.category || "").toLowerCase().includes(s)
    );
  });

  if (loading) return <LoadingState message="Loading knowledge hub…" />;

  return (
    <div>
      <PageHeader
        title="Knowledge Hub"
        description="SOPs · FAQs · policies · training · AI-suggested while typing"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline"><Link href="/dashboard/chat">Chat</Link></Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Article</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create}>
                  <DialogHeader><DialogTitle>Knowledge article</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Title</Label>
                      <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Body (Markdown supported)</Label>
                      <textarea
                        className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                        value={form.body}
                        onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Publish</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Input className="max-w-md mb-4" placeholder="Search knowledge…" value={q} onChange={(e) => setQ(e.target.value)} />

      {filtered.length === 0 ? (
        <EmptyState title="No articles" description="Seed articles ship with migration 00043." icon={BookOpen} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((r) => (
            <Card key={String(r.id)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  {String(r.title)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" className="text-[10px] mb-2">{String(r.category || "general")}</Badge>
                <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                  {String(r.body)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
