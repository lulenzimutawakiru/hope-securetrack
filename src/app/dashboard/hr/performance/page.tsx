"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

const RATINGS = [
  "outstanding",
  "exceeds",
  "meets",
  "needs_improvement",
  "unsatisfactory",
];

export default function PerformancePage() {
  const { auth } = useUser();
  const [reviews, setReviews] = useState<Array<Record<string, unknown>>>([]);
  const [objectives, setObjectives] = useState<Array<Record<string, unknown>>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; last_name: string; employee_number: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    period_label: "2026 Mid-year",
    review_type: "mid_year",
    rating: "meets",
    score: "3.5",
    strengths: "",
    improvements: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: r }, { data: o }, { data: e }] = await Promise.all([
      supabase
        .from("performance_reviews")
        .select("*, employees(first_name,last_name,employee_number)")
        .order("review_date", { ascending: false }),
      supabase
        .from("employee_objectives")
        .select("*, employees(first_name,last_name)")
        .eq("status", "active")
        .limit(50),
      supabase
        .from("employees")
        .select("id,first_name,last_name,employee_number")
        .eq("status", "active")
        .order("last_name"),
    ]);
    setReviews(r ?? []);
    setObjectives(o ?? []);
    setEmployees(e ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const num = `PRV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const crudRes = await crudCreate("performance_reviews", {
      company_id: auth.profile.company_id,
      review_number: num,
      employee_id: form.employee_id,
      reviewer_id: auth.profile.id,
      period_label: form.period_label,
      review_type: form.review_type,
      rating: form.rating,
      score: Number(form.score),
      strengths: form.strengths || null,
      improvements: form.improvements || null,
      status: "submitted",
    });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Review submitted");
      setOpen(false);
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Performance Management"
        description="KPIs · OKRs · annual & probation reviews · 360° readiness"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/hr">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New review
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={create} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>Performance review</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-1">
                    <Label>Employee</Label>
                    <Select
                      value={form.employee_id}
                      onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.employee_number} — {e.first_name} {e.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Period</Label>
                      <Input
                        value={form.period_label}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, period_label: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Rating</Label>
                      <Select
                        value={form.rating}
                        onValueChange={(v) => setForm((f) => ({ ...f, rating: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RATINGS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Score (1–5)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      step="0.1"
                      value={form.score}
                      onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Strengths</Label>
                    <Input
                      value={form.strengths}
                      onChange={(e) => setForm((f) => ({ ...f, strengths: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Improvements</Label>
                    <Input
                      value={form.improvements}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, improvements: e.target.value }))
                      }
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Submit review</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {reviews.length === 0 ? (
        <EmptyState icon={Target} title="No reviews" description="Create performance appraisals" />
      ) : (
        <div className="rounded-lg border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Review #</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((r) => {
                const emp = r.employees as {
                  first_name?: string;
                  last_name?: string;
                  employee_number?: string;
                } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="font-mono text-sm">
                      {String(r.review_number)}
                    </TableCell>
                    <TableCell>
                      {emp?.employee_number} {emp?.first_name} {emp?.last_name}
                    </TableCell>
                    <TableCell>{String(r.period_label ?? "—")}</TableCell>
                    <TableCell className="capitalize">
                      {String(r.review_type).replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.rating ?? "meets")} />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(Number(r.score || 0))}
                    </TableCell>
                    <TableCell>
                      {r.review_date ? formatDate(String(r.review_date)) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {objectives.length > 0 && (
        <>
          <h3 className="font-medium mb-2">Active objectives (OKRs)</h3>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Objective</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead>Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {objectives.map((o) => {
                  const emp = o.employees as {
                    first_name?: string;
                    last_name?: string;
                  } | null;
                  return (
                    <TableRow key={String(o.id)}>
                      <TableCell>
                        {emp?.first_name} {emp?.last_name}
                      </TableCell>
                      <TableCell>{String(o.title)}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(Number(o.target_value || 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(Number(o.actual_value || 0))}
                      </TableCell>
                      <TableCell>
                        {o.due_date ? formatDate(String(o.due_date)) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
