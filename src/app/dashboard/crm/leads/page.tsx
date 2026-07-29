"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Target, ArrowRight, Sparkles } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { useUser } from "@/hooks/use-user";
import {
  listLeads,
  createLead,
  updateLeadStatus,
  convertLeadToCustomer,
  LEAD_STAGES,
} from "@/lib/crm";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function CrmLeadsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    source: "website",
    industry: "Education",
    estimated_value: "10000000",
    territory: "Central Uganda",
  });

  const load = async () => {
    try {
      const data = await listLeads();
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load leads");
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
      await createLead(
        {
          company_id: auth.profile.company_id,
          company_name: form.company_name,
          contact_name: form.contact_name,
          email: form.email,
          phone: form.phone,
          source: form.source,
          industry: form.industry,
          estimated_value: parseFloat(form.estimated_value) || 0,
          territory: form.territory,
        },
        auth.user.id
      );
      toast.success("Lead created with AI score");
      setOpen(false);
      setForm({ ...form, company_name: "", contact_name: "", email: "", phone: "" });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      await updateLeadStatus(id, status);
      toast.success(`Status → ${status}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const convert = async (id: string) => {
    try {
      const cust = await convertLeadToCustomer(id, auth?.user.id);
      toast.success(`Converted to customer ${cust.code}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Conversion failed");
    }
  };

  if (loading) return <LoadingState message="Loading leads…" />;

  const openCount = rows.filter((r) => !["converted", "lost", "unqualified"].includes(String(r.status))).length;
  const avgScore = rows.length
    ? Math.round(rows.reduce((s, r) => s + Number(r.lead_score || r.ai_score || 0), 0) / rows.length)
    : 0;
  const pipeline = rows
    .filter((r) => !["converted", "lost", "unqualified"].includes(String(r.status)))
    .reduce((s, r) => s + Number(r.estimated_value || 0), 0);

  return (
    <div>
      <PageHeader
        title="Lead Management"
        description="Website · WhatsApp · referral · tender · QR · API — AI lead scoring"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/crm">Hub</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Capture lead</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <form onSubmit={submit}>
                  <DialogHeader>
                    <DialogTitle>New lead</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Company / organization</Label>
                      <Input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Contact</Label>
                        <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                      </div>
                      <div>
                        <Label>Source</Label>
                        <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["website", "referral", "whatsapp", "phone", "trade_show", "qr_code", "sales_rep", "tender", "api", "manual"].map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                        <Label>Est. value (UGX)</Label>
                        <Input value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} />
                      </div>
                      <div>
                        <Label>Industry</Label>
                        <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create lead</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Open leads" value={formatNumber(openCount)} icon={Target} />
        <StatCard title="Avg AI score" value={String(avgScore)} icon={Sparkles} />
        <StatCard title="Open value" value={formatNumber(pipeline)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No leads" description="Capture leads from any channel." />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead #</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{String(r.lead_number)}</TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{String(r.company_name)}</div>
                    <div className="text-xs text-muted-foreground">{String(r.contact_name || "")}</div>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{String(r.source || "—")}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell>
                    <Badge variant={Number(r.lead_score || 0) >= 70 ? "default" : "secondary"}>
                      {String(r.lead_score ?? r.ai_score ?? 0)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatNumber(Number(r.estimated_value || 0))}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Select onValueChange={(v) => setStatus(String(r.id), v)}>
                        <SelectTrigger className="h-8 w-[110px] text-xs">
                          <SelectValue placeholder="Stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STAGES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!["converted", "lost", "unqualified"].includes(String(r.status)) && (
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => convert(String(r.id))}>
                          <ArrowRight className="h-3 w-3 mr-1" /> Convert
                        </Button>
                      )}
                    </div>
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
