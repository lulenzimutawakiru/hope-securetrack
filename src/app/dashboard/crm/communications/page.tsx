"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, MessageSquare } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { listCommunications, logCommunication, listCustomers } from "@/lib/crm";
import { toast } from "sonner";

export default function CrmCommunicationsPage() {
  const { auth } = useUser();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [customers, setCustomers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    channel: "email",
    subject: "",
    body: "",
    direction: "outbound",
  });

  const load = async () => {
    try {
      const [c, cust] = await Promise.all([listCommunications(80), listCustomers({ limit: 80 })]);
      setRows(c);
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
      await logCommunication({
        company_id: auth.profile.company_id,
        customer_id: form.customer_id || null,
        channel: form.channel,
        subject: form.subject,
        body: form.body,
        direction: form.direction,
        status: "sent",
        created_by: auth.user.id,
      });
      toast.success("Communication logged to timeline");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading communications…" />;

  return (
    <div>
      <PageHeader
        title="Customer Communication Hub"
        description="Email · SMS · WhatsApp Business · SecureChat · voice logs · portal messages"
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/chat">SecureChat</Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Log message</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={submit}>
                  <DialogHeader><DialogTitle>Log communication</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Customer</Label>
                      <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={String(c.id)} value={String(c.id)}>{String(c.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Channel</Label>
                        <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["email", "sms", "whatsapp", "hopechat", "phone", "portal"].map((ch) => (
                              <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Direction</Label>
                        <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="outbound">Outbound</SelectItem>
                            <SelectItem value="inbound">Inbound</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Subject</Label>
                      <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                    </div>
                    <div>
                      <Label>Body</Label>
                      <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Log</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No communications" description="Log emails, SMS, and WhatsApp touches." />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell><Badge variant="outline" className="capitalize text-[10px]">{String(r.channel)}</Badge></TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{String(r.subject || "(no subject)")}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[320px]">{String(r.body || "")}</div>
                  </TableCell>
                  <TableCell className="capitalize text-sm">{String(r.direction)}</TableCell>
                  <TableCell><StatusBadge status={String(r.status)} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.sent_at || r.created_at
                      ? new Date(String(r.sent_at || r.created_at)).toLocaleString()
                      : "—"}
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
