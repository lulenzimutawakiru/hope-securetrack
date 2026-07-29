"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
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
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import { listOnboarding, createOnboarding, reviewOnboarding, SUPPLIER_CATEGORIES } from "@/lib/srm";
import { toast } from "sonner";

export default function SrmOnboardingPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    category: "raw_materials",
    contact_name: "",
    email: "",
    phone: "",
    tin_number: "",
    registration_number: "",
  });

  const load = async () => {
    try {
      setRows(await listOnboarding());
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
      await createOnboarding({
        company_id: auth.profile.company_id,
        company_name: form.company_name,
        category: form.category,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone,
        tin_number: form.tin_number,
        registration_number: form.registration_number,
        created_by: auth.user.id,
      });
      toast.success("Onboarding application submitted");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const review = async (id: string, status: "approved" | "rejected" | "under_review" | "documents_pending") => {
    if (!auth) return;
    try {
      await reviewOnboarding(id, status, {
        reviewer_id: auth.user.id,
        company_id: auth.profile.company_id,
        reason: status === "rejected" ? "Does not meet qualification criteria" : undefined,
      });
      toast.success(`Application ${status.replace(/_/g, " ")}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading onboarding…" />;

  const pending = rows.filter((r) =>
    ["submitted", "under_review", "documents_pending"].includes(String(r.status))
  ).length;

  return (
    <div>
      <PageHeader
        title="Supplier Onboarding"
        description="Registration · TIN/VAT · bank · ISO · insurance · due diligence · approval workflow"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/procurement">SRM Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New application</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Supplier onboarding application</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Company name</Label>
                      <Input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Category</Label>
                        <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SUPPLIER_CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Contact</Label>
                        <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Email</Label>
                        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>TIN</Label>
                        <Input value={form.tin_number} onChange={(e) => setForm({ ...form, tin_number: e.target.value })} />
                      </div>
                      <div>
                        <Label>Registration #</Label>
                        <Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Submit</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Applications" value={String(rows.length)} icon={UserPlus} />
        <StatCard title="Pending review" value={String(pending)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No applications" description="Start digital supplier onboarding." />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App #</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.application_number)}</TableCell>
                  <TableCell className="font-medium text-sm">{String(r.company_name)}</TableCell>
                  <TableCell className="text-sm capitalize">{String(r.category || "—").replace(/_/g, " ")}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell className="text-sm">
                    <div>{String(r.contact_name || "—")}</div>
                    <div className="text-[10px] text-muted-foreground">{String(r.email || "")}</div>
                  </TableCell>
                  <TableCell>
                    {!["approved", "rejected"].includes(String(r.status)) && (
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" className="h-7 text-xs" onClick={() => review(String(r.id), "approved")}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => review(String(r.id), "under_review")}>
                          Review
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => review(String(r.id), "rejected")}>
                          Reject
                        </Button>
                      </div>
                    )}
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
