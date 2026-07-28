"use client";

import { useEffect, useState } from "react";
import { Megaphone, Plus } from "lucide-react";
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
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function CrmCampaignsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    channel: "email",
    segment: "All active customers",
    budget: "0",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("crm_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const code = `CMP-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from("crm_campaigns").insert({
      company_id: auth.profile.company_id,
      code,
      name: form.name,
      channel: form.channel,
      segment: form.segment,
      budget: parseFloat(form.budget) || 0,
      currency: "UGX",
      status: "draft",
      created_by: auth.profile.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Campaign created");
      setOpen(false);
      load();
    }
  };

  const setStatus = async (id: string, status: string) => {
    const supabase = createClient();
    await supabase.from("crm_campaigns").update({ status }).eq("id", id);
    toast.success("Campaign updated");
    load();
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Marketing Campaigns"
        description="Email · SMS · WhatsApp · segments · campaign analytics foundation"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New campaign
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={create}>
                <DialogHeader>
                  <DialogTitle>Create campaign</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <Select
                    value={form.channel}
                    onValueChange={(v) => setForm({ ...form, channel: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["email", "sms", "whatsapp", "social", "event"].map(
                        (c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Segment"
                    value={form.segment}
                    onChange={(e) =>
                      setForm({ ...form, segment: e.target.value })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Budget UGX"
                    value={form.budget}
                    onChange={(e) =>
                      setForm({ ...form, budget: e.target.value })
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
        <EmptyState icon={Megaphone} title="No campaigns yet" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">
                    {String(r.code)}
                  </TableCell>
                  <TableCell className="font-medium">{String(r.name)}</TableCell>
                  <TableCell className="capitalize">{String(r.channel)}</TableCell>
                  <TableCell className="text-sm max-w-[160px] truncate">
                    {String(r.segment || "—")}
                  </TableCell>
                  <TableCell>
                    UGX {formatNumber(Number(r.budget || 0))}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={String(r.status)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Select
                      value={String(r.status)}
                      onValueChange={(v) => setStatus(String(r.id), v)}
                    >
                      <SelectTrigger className="w-[120px] ml-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "draft",
                          "scheduled",
                          "running",
                          "completed",
                          "cancelled",
                        ].map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
