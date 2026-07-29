"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { listCustomers, submitFeedback } from "@/lib/crm";
import { toast } from "sonner";

export default function CrmFeedbackPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    score_type: "csat",
    score: "5",
    comment: "",
    channel: "portal",
  });

  const load = async () => {
    try {
      const supabase = createClient();
      const [{ data }, cust] = await Promise.all([
        supabase.from("crm_feedback").select("*").order("created_at", { ascending: false }).limit(100),
        listCustomers({ limit: 80 }),
      ]);
      setRows(data || []);
      setCustomers(cust);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    try {
      await submitFeedback({
        company_id: auth.profile.company_id,
        customer_id: form.customer_id || null,
        score_type: form.score_type,
        score: parseInt(form.score, 10),
        comment: form.comment,
        channel: form.channel,
      });
      toast.success("Feedback recorded with AI sentiment");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading feedback…" />;

  const csat = rows.filter((r) => r.score_type === "csat");
  const nps = rows.filter((r) => r.score_type === "nps");
  const avgCsat = csat.length
    ? (csat.reduce((s, r) => s + Number(r.score), 0) / csat.length).toFixed(1)
    : "—";
  const avgNps = nps.length
    ? Math.round(nps.reduce((s, r) => s + Number(r.score), 0) / nps.length)
    : "—";
  const positive = rows.filter((r) => r.sentiment === "positive").length;

  return (
    <div>
      <PageHeader
        title="Customer Feedback"
        description="CSAT · NPS · reviews · complaints · AI sentiment analysis"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/crm">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Record feedback</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Capture feedback</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Customer</Label>
                      <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={String(c.id)} value={String(c.id)}>{String(c.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>Type</Label>
                        <Select value={form.score_type} onValueChange={(v) => setForm({ ...form, score_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="csat">CSAT</SelectItem>
                            <SelectItem value="nps">NPS</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Score</Label>
                        <Input type="number" min={0} max={10} value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
                      </div>
                      <div>
                        <Label>Channel</Label>
                        <Input value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Comment</Label>
                      <Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} rows={3} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Avg CSAT" value={String(avgCsat)} icon={Sparkles} />
        <StatCard title="Avg NPS" value={String(avgNps)} />
        <StatCard title="Positive sentiment" value={`${positive}/${rows.length}`} />
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Sentiment</TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={String(r.id)}>
                <TableCell className="uppercase text-xs font-medium">{String(r.score_type)}</TableCell>
                <TableCell className="font-semibold">{String(r.score)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      r.sentiment === "positive"
                        ? "default"
                        : r.sentiment === "negative"
                          ? "destructive"
                          : "secondary"
                    }
                    className="capitalize text-[10px]"
                  >
                    {String(r.sentiment || "neutral")}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm max-w-[280px] truncate">{String(r.comment || "—")}</TableCell>
                <TableCell className="text-sm">{String(r.channel || "—")}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.created_at ? new Date(String(r.created_at)).toLocaleDateString() : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
