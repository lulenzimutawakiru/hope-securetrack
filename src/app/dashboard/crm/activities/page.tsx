"use client";

import { useEffect, useState } from "react";
import { Calendar, Plus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const TYPES = [
  "call",
  "meeting",
  "site_visit",
  "demo",
  "follow_up",
  "email",
  "whatsapp",
  "presentation",
  "tender",
  "other",
];

export default function CrmActivitiesPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    activity_type: "call",
    subject: "",
    scheduled_at: "",
    location: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data }, { data: c }] = await Promise.all([
      supabase
        .from("crm_activities")
        .select("*, customers(name)")
        .order("scheduled_at", { ascending: false })
        .limit(100),
      supabase.from("customers").select("id,name").eq("is_active", true),
    ]);
    setRows(data ?? []);
    setCustomers(c ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const { error } = await supabase.from("crm_activities").insert({
      company_id: auth.profile.company_id,
      customer_id: form.customer_id || null,
      activity_type: form.activity_type,
      subject: form.subject,
      scheduled_at: form.scheduled_at
        ? new Date(form.scheduled_at).toISOString()
        : new Date().toISOString(),
      location: form.location || null,
      status: "planned",
      owner_id: auth.profile.id,
      created_by: auth.profile.id,
    });
    if (error) toast.error(error.message);
    else {
      if (form.customer_id) {
        await supabase
          .from("customers")
          .update({ last_contact_at: new Date().toISOString() })
          .eq("id", form.customer_id);
      }
      toast.success("Activity scheduled");
      setOpen(false);
      load();
    }
  };

  const complete = async (id: string) => {
    const supabase = createClient();
    await supabase
      .from("crm_activities")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Marked completed");
    load();
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="CRM Activities"
        description="Calls, meetings, site visits, demos, tender follow-ups — full interaction log"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Schedule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader>
                  <DialogTitle>New activity</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    <Select
                      value={form.customer_id}
                      onValueChange={(v) => setForm({ ...form, customer_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={form.activity_type}
                      onValueChange={(v) =>
                        setForm({ ...form, activity_type: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input
                      required
                      value={form.subject}
                      onChange={(e) =>
                        setForm({ ...form, subject: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>When</Label>
                    <Input
                      type="datetime-local"
                      value={form.scheduled_at}
                      onChange={(e) =>
                        setForm({ ...form, scheduled_at: e.target.value })
                      }
                    />
                  </div>
                  <Input
                    placeholder="Location"
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Calendar} title="No activities" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const cust = r.customers as { name: string } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell className="text-xs">
                      {r.scheduled_at
                        ? formatDateTime(String(r.scheduled_at))
                        : "—"}
                    </TableCell>
                    <TableCell className="capitalize text-xs">
                      {String(r.activity_type).replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {String(r.subject)}
                    </TableCell>
                    <TableCell>{cust?.name ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={String(r.status)} />
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "planned" && (
                        <Button size="sm" onClick={() => complete(String(r.id))}>
                          Complete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
