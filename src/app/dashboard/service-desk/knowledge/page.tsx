"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, Search, ThumbsUp, ThumbsDown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { createKnowledgeArticle, searchKnowledge } from "@/lib/service-desk";

export default function KnowledgePage() {
  const { auth } = useUser();
  const [articles, setArticles] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    summary: "",
    body: "",
    category: "general",
    tags: "",
    publish: true,
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const { data } = await createClient()
      .from("sd_knowledge_articles")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(200);
    setArticles((data as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return articles;
    return searchKnowledge(
      q,
      articles.map((a) => ({
        id: String(a.id),
        title: String(a.title),
        summary: a.summary as string | null,
        body: String(a.body || ""),
        category: a.category as string | null,
        tags: a.tags as string[] | null,
      }))
    ).map((m) => articles.find((a) => String(a.id) === m.id)!).filter(Boolean);
  }, [articles, q]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    try {
      await createKnowledgeArticle({
        company_id: companyId,
        title: form.title,
        body: form.body,
        summary: form.summary,
        category: form.category,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        author_id: auth?.user?.id,
        publish: form.publish,
      });
      toast.success("Article created");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const feedback = async (id: string, yes: boolean) => {
    const a = articles.find((x) => String(x.id) === id);
    if (!a) return;
    const patch = yes
      ? { helpful_yes: Number(a.helpful_yes || 0) + 1 }
      : { helpful_no: Number(a.helpful_no || 0) + 1 };
    await createClient().from("sd_knowledge_articles").update(patch).eq("id", id);
    toast.success("Thanks for the feedback");
    await load();
  };

  if (loading) return <LoadingState message="Loading knowledge base…" />;

  const published = articles.filter((a) => a.status === "published").length;

  return (
    <div>
      <PageHeader
        title="Knowledge Management"
        description="Articles · FAQs · SOPs · AI search · ratings · versioning"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New article</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreate}>
                <DialogHeader><DialogTitle>Create article</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div>
                    <Label>Title</Label>
                    <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Summary</Label>
                    <Input value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Body (markdown supported)</Label>
                    <textarea
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                      value={form.body}
                      onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Category</Label>
                      <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Tags (comma)</Label>
                      <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.publish}
                      onChange={(e) => setForm((f) => ({ ...f, publish: e.target.checked }))}
                    />
                    Publish immediately
                  </label>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Articles" value={String(articles.length)} icon={BookOpen} />
        <StatCard title="Published" value={String(published)} icon={BookOpen} />
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="AI search knowledge base…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState title="No articles" description="Create SOPs and FAQs for the AI assistant." />
          ) : (
            filtered.map((a) => (
              <button
                key={String(a.id)}
                type="button"
                onClick={async () => {
                  setSelected(a);
                  await createClient()
                    .from("sd_knowledge_articles")
                    .update({ view_count: Number(a.view_count || 0) + 1 })
                    .eq("id", String(a.id));
                }}
                className={`w-full text-left rounded-lg border p-3 hover:bg-muted/40 ${
                  selected && String(selected.id) === String(a.id) ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-sm">{String(a.title)}</span>
                  <Badge variant="outline" className="text-[10px] capitalize shrink-0">{String(a.status)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{String(a.summary || a.body)}</p>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">{String(a.article_number)}</div>
              </button>
            ))
          )}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {selected ? String(selected.title) : "Select an article"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-sm text-muted-foreground">Browse or search the knowledge base.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{String(selected.category || "general")}</Badge>
                  {((selected.tags as string[]) || []).map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                  {String(selected.body)}
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => feedback(String(selected.id), true)}>
                    <ThumbsUp className="h-3.5 w-3.5 mr-1" /> {String(selected.helpful_yes || 0)}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => feedback(String(selected.id), false)}>
                    <ThumbsDown className="h-3.5 w-3.5 mr-1" /> {String(selected.helpful_no || 0)}
                  </Button>
                  <span className="text-xs text-muted-foreground self-center ml-auto">
                    Views: {String(selected.view_count || 0)} · v{String(selected.version || 1)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
