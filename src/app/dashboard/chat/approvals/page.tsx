"use client";

import { useEffect, useState } from "react";
import {
  Plus, Check, X, FileEdit, Loader2, Clock, Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDateTime, cn } from "@/lib/utils";
import {
  listApprovals, createApproval, decideApproval, listCompanyUsers, APPROVAL_TYPES,
} from "@/lib/hopechat";
import type { ApprovalDecision } from "@/lib/hopechat";
import { toast } from "sonner";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  changes_requested: "secondary",
  cancelled: "outline",
};

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "changes_requested", label: "Changes" },
] as const;

const CURRENCIES = ["UGX", "USD", "EUR", "GBP", "KES", "TZS", "ZAR"] as const;

type CompanyUser = { id: string; name: string; email?: string | null };

interface DecisionTarget {
  id: string;
  title: string;
  decision: ApprovalDecision;
}

export default function ChatApprovalsPage() {
  const { auth } = useUser();
  const [approvals, setApprovals] = useState<Array<Record<string, unknown>>>([]);
  const [channels, setChannels] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    entity_type: "other",
    amount: "",
    currency: "UGX",
    requester_name: "",
    approver_id: "none",
    channel_id: "none",
    priority: "normal",
  });

  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState<DecisionTarget | null>(null);
  const [decisionComment, setDecisionComment] = useState("");

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.user?.id;
  const userName =
    auth?.profile
      ? `${auth.profile.first_name} ${auth.profile.last_name}`.trim()
      : "";

  const load = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [apprRes, chanRes, userRes] = await Promise.all([
      listApprovals(companyId, filter === "all" ? undefined : filter),
      supabase
        .from("hc_channels")
        .select("id,name,channel_type")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .eq("is_archived", false)
        .order("last_message_at", { ascending: false })
        .limit(200),
      listCompanyUsers(companyId),
    ]);
    setApprovals((apprRes as Array<Record<string, unknown>>) || []);
    setChannels((chanRes.data as Array<Record<string, unknown>>) || []);
    setUsers((userRes as CompanyUser[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [companyId, filter]);

  const openDecision = (approval: Record<string, unknown>, decision: ApprovalDecision) => {
    setDecisionTarget({ id: String(approval.id), title: String(approval.title || ""), decision });
    setDecisionComment("");
    setDecisionOpen(true);
  };

  const submitDecision = async () => {
    if (!decisionTarget || !companyId) return;
    setActingId(decisionTarget.id);
    try {
      await decideApproval({
        approval_id: decisionTarget.id,
        company_id: companyId,
        decision: decisionTarget.decision,
        comment: decisionComment || null,
        actor_id: userId,
        actor_name: userName || null,
      });
      toast.success(`Approval ${decisionTarget.decision.replace("_", " ")}`);
      setDecisionOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setActingId(null);
    }
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    try {
      await createApproval({
        company_id: companyId,
        entity_type: form.entity_type,
        title: form.title,
        description: form.description || null,
        amount: form.amount ? Number(form.amount) : null,
        currency: form.currency,
        requester_name: form.requester_name || userName || null,
        approver_id: form.approver_id === "none" ? null : form.approver_id,
        approver_name:
          form.approver_id === "none"
            ? null
            : users.find((u) => u.id === form.approver_id)?.name || null,
        channel_id: form.channel_id === "none" ? null : form.channel_id,
        priority: form.priority,
        created_by: userId,
        post_to_channel: form.channel_id !== "none",
      });
      toast.success("Approval request created");
      setCreateOpen(false);
      setForm({
        title: "",
        description: "",
        entity_type: "other",
        amount: "",
        currency: "UGX",
        requester_name: "",
        approver_id: "none",
        channel_id: "none",
        priority: "normal",
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading approval center..." />;

  return (
    <div>
      <PageHeader
        title="Approval Center"
        description="Approve purchase orders, payments, leave, expenses, contracts and service requests from chat"
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> New approval
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <form onSubmit={submitCreate}>
                <DialogHeader>
                  <DialogTitle>Create approval request</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid gap-1.5">
                    <Label>Title</Label>
                    <Input
                      required
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Approve payment to ABC Ltd"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Type</Label>
                    <Select
                      value={form.entity_type}
                      onValueChange={(v) => setForm({ ...form, entity_type: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {APPROVAL_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Description</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Context, supplier, asset or reference number"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Currency</Label>
                      <Select
                        value={form.currency}
                        onValueChange={(v) => setForm({ ...form, currency: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Requester</Label>
                    <Input
                      value={form.requester_name}
                      onChange={(e) => setForm({ ...form, requester_name: e.target.value })}
                      placeholder={userName || "Requester name"}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Approver</Label>
                    <Select
                      value={form.approver_id}
                      onValueChange={(v) => setForm({ ...form, approver_id: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No specific approver</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Post to channel</Label>
                    <Select
                      value={form.channel_id}
                      onValueChange={(v) => setForm({ ...form, channel_id: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No channel</SelectItem>
                        {channels.map((c) => (
                          <SelectItem key={String(c.id)} value={String(c.id)}>
                            #{String(c.name)} ({String(c.channel_type || "channel")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Priority</Label>
                    <Select
                      value={form.priority}
                      onValueChange={(v) => setForm({ ...form, priority: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving || !form.title.trim()}>
                    {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {approvals.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No approvals found"
          description="Create an approval request or change the status filter."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Approver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.map((a) => (
                  <TableRow key={String(a.id)}>
                    <TableCell className="max-w-[260px]">
                      <p className="truncate font-medium">{String(a.title)}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(a.entity_type || "other").replace("_", " ")} -{" "}
                        {formatDateTime(String(a.created_at || ""))}
                      </p>
                      {Boolean(a.decision_comment) && (
                        <p className="mt-1 text-xs text-muted-foreground italic">
                          &ldquo;{String(a.decision_comment)}&rdquo;
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.amount !== null && a.amount !== undefined ? (
                        <Badge variant="outline">
                          {String(a.currency || "UGX")} {Number(a.amount).toLocaleString()}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>{String(a.requester_name || "--")}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {String(a.approver_name || "Anyone")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[String(a.status)] || "outline"}>
                        {String(a.status || "").replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {String(a.status) === "pending" ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600"
                            disabled={actingId === String(a.id)}
                            onClick={() => openDecision(a, "approved")}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            disabled={actingId === String(a.id)}
                            onClick={() => openDecision(a, "rejected")}
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={actingId === String(a.id)}
                            onClick={() => openDecision(a, "changes_requested")}
                          >
                            <FileEdit className="h-3.5 w-3.5 mr-1" /> Changes
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {a.decided_at ? formatDateTime(String(a.decided_at)) : "--"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionTarget ? decisionTarget.decision.replace("_", " ") : "Decision"} -{" "}
              {decisionTarget?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-3">
            <Label>Comment (optional)</Label>
            <Textarea
              value={decisionComment}
              onChange={(e) => setDecisionComment(e.target.value)}
              placeholder="Reason or instructions for the requester"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionOpen(false)}>Cancel</Button>
            <Button
              disabled={actingId !== null}
              onClick={submitDecision}
              variant={decisionTarget?.decision === "rejected" ? "destructive" : "default"}
            >
              {actingId && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}