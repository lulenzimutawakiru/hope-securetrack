"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BellRing,
  Bot,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Contact,
  DollarSign,
  GripVertical,
  Kanban,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  StickyNote,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Stage = {
  id: string;
  name: string;
  position: number;
  probability: number;
  color: string;
  is_won: boolean;
  is_lost: boolean;
};

type Account = {
  id: string;
  name: string;
  website?: string | null;
  industry?: string | null;
  country?: string | null;
  city?: string | null;
  size_band?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  source?: string | null;
  lead_id?: string | null;
  description?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
};

type Contact = {
  id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  department?: string | null;
  is_primary: boolean;
  source?: string | null;
  notes?: string | null;
  account_name?: string | null;
};

type Deal = {
  id: string;
  account_id: string;
  contact_id?: string | null;
  name: string;
  amount: number | string;
  currency: string;
  stage_id: string;
  probability: number;
  priority: string;
  owner_id?: string | null;
  source?: string | null;
  lead_id?: string | null;
  expected_close?: string | null;
  notes?: string | null;
  won_at?: string | null;
  lost_at?: string | null;
  closed_reason?: string | null;
  account_name?: string | null;
  contact_name?: string | null;
  stage_name?: string | null;
  stage_color?: string | null;
  lead_name?: string | null;
};

type Activity = {
  id: string;
  kind: string;
  subject: string;
  description?: string | null;
  account_id?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
  lead_id?: string | null;
  due_at?: string | null;
  done: boolean;
  completed_at?: string | null;
  outcome?: string | null;
  account_name?: string | null;
  deal_name?: string | null;
  created_at?: string | null;
};

type Template = {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  is_default: boolean;
};

type Lead = {
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
  industry?: string | null;
  country?: string | null;
  status: string;
};

type CrmStats = {
  accounts_count: number;
  contacts_count: number;
  deals_count: number;
  open_deals: number;
  won_deals: number;
  lost_deals: number;
  pipeline_value: number;
  weighted_pipeline: number;
  won_value_total: number;
  won_value_30d: number;
  avg_deal_size: number;
  conversion_rate: number;
  activities_count: number;
  pending_tasks: number;
  due_today: number;
  overdue_tasks: number;
  templates_count: number;
};

type Overview = {
  stages: Stage[];
  deals: Deal[];
  accounts: Account[];
  contacts: Contact[];
  activities: Activity[];
  templates: Template[];
  leads: Lead[];
  stats: CrmStats;
};

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const DASH = "\u2014";

const KIND_LABEL: Record<string, string> = {
  call: "Call",
  meeting: "Meeting",
  email: "Email",
  note: "Note",
  task: "Task",
  follow_up: "Follow-up",
  system: "System",
};

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  meeting: Users,
  email: Mail,
  note: StickyNote,
  task: CheckCircle2,
  follow_up: BellRing,
  system: Bot,
};

const STAGE_DOT: Record<string, string> = {
  slate: "bg-slate-400",
  sky: "bg-sky-400",
  indigo: "bg-indigo-400",
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
  rose: "bg-rose-400",
};

const PRIORITY_VARIANT: Record<string, "outline" | "secondary" | "default"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
};

const ACCOUNT_STATUS_VARIANT: Record<string, "outline" | "default" | "destructive"> = {
  prospect: "outline",
  active: "default",
  churned: "destructive",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatMoney(value: number | string | null | undefined, currency = "UGX") {
  const n = Number(value) || 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: n % 1 ? 2 : 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

function formatDate(value?: string | null) {
  if (!value) return DASH;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value?: string | null) {
  if (!value) return DASH;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function isWon(d: Deal) {
  return Boolean(d.won_at) && !Boolean(d.lost_at);
}

function isLost(d: Deal) {
  return Boolean(d.lost_at);
}

function fullName(c: Contact) {
  return `${c.first_name} ${c.last_name}`.trim();
}
/* ------------------------------------------------------------------ */
/* Shared API helper                                                   */
/* ------------------------------------------------------------------ */

async function apiMutate<T = unknown>(
  method: "POST" | "PATCH" | "DELETE",
  payload: unknown
): Promise<T> {
  const res = await fetch("/api/platform/crm", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error?.message || "Request failed");
  }
  return (json.data ?? json) as T;
}

function field(name: string, label: string, value: string, onChange: (v: string) => void, placeholder?: string) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs font-medium">{label}</Label>
      <Input id={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialogs                                                             */
/* ------------------------------------------------------------------ */

function AccountDialog({
  open,
  onOpenChange,
  account,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  account?: Account | null;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [website, setWebsite] = useState(account?.website ?? "");
  const [industry, setIndustry] = useState(account?.industry ?? "");
  const [country, setCountry] = useState(account?.country ?? "");
  const [city, setCity] = useState(account?.city ?? "");
  const [sizeBand, setSizeBand] = useState(account?.size_band ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [status, setStatus] = useState(account?.status ?? "prospect");
  const [source, setSource] = useState(account?.source ?? "");
  const [description, setDescription] = useState(account?.description ?? "");

  useEffect(() => {
    if (open) {
      setName(account?.name ?? "");
      setWebsite(account?.website ?? "");
      setIndustry(account?.industry ?? "");
      setCountry(account?.country ?? "");
      setCity(account?.city ?? "");
      setSizeBand(account?.size_band ?? "");
      setPhone(account?.phone ?? "");
      setEmail(account?.email ?? "");
      setStatus(account?.status ?? "prospect");
      setSource(account?.source ?? "");
      setDescription(account?.description ?? "");
    }
  }, [open, account]);

  const submit = async () => {
    if (name.trim().length < 2) {
      toast.error("Account name is required");
      return;
    }
    const data: Record<string, unknown> = {
      name: name.trim(),
      website: website.trim() || null,
      industry: industry.trim() || null,
      country: country.trim() || null,
      city: city.trim() || null,
      size_band: sizeBand.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      status,
      source: source.trim() || null,
      description: description.trim() || null,
    };
    await onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "New account"}</DialogTitle>
          <DialogDescription>
            {account ? "Update organization details." : "Create a new organization account."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {field("name", "Account name *", name, setName)}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("website", "Website", website, setWebsite)}
            {field("industry", "Industry", industry, setIndustry)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("country", "Country", country, setCountry)}
            {field("city", "City", city, setCity)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("phone", "Phone", phone, setPhone)}
            {field("email", "Email", email, setEmail)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="acct-status" className="text-xs font-medium">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="acct-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-size" className="text-xs font-medium">Company size</Label>
              <Select value={sizeBand} onValueChange={setSizeBand}>
                <SelectTrigger id="acct-size"><SelectValue placeholder="Select size" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-50">1-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="201-1000">201-1000 employees</SelectItem>
                  <SelectItem value="1000+">1000+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {field("source", "Lead source", source, setSource)}
          <div className="space-y-1.5">
            <Label htmlFor="acct-desc" className="text-xs font-medium">Description</Label>
            <Textarea id="acct-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {account ? "Save changes" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContactDialog({
  open,
  onOpenChange,
  contact,
  accounts,
  defaultAccountId,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact?: Contact | null;
  accounts: Account[];
  defaultAccountId?: string;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  const [accountId, setAccountId] = useState(defaultAccountId ?? contact?.account_id ?? "");
  const [firstName, setFirstName] = useState(contact?.first_name ?? "");
  const [lastName, setLastName] = useState(contact?.last_name ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [jobTitle, setJobTitle] = useState(contact?.job_title ?? "");
  const [department, setDepartment] = useState(contact?.department ?? "");
  const [isPrimary, setIsPrimary] = useState(contact?.is_primary ?? false);

  useEffect(() => {
    if (open) {
      setAccountId(defaultAccountId ?? contact?.account_id ?? "");
      setFirstName(contact?.first_name ?? "");
      setLastName(contact?.last_name ?? "");
      setEmail(contact?.email ?? "");
      setPhone(contact?.phone ?? "");
      setJobTitle(contact?.job_title ?? "");
      setDepartment(contact?.department ?? "");
      setIsPrimary(contact?.is_primary ?? false);
    }
  }, [open, contact, defaultAccountId]);

  const submit = async () => {
    if (!accountId) {
      toast.error("Select an account");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }
    const data: Record<string, unknown> = {
      account_id: accountId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      job_title: jobTitle.trim() || null,
      department: department.trim() || null,
      is_primary: isPrimary,
    };
    await onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "New contact"}</DialogTitle>
          <DialogDescription>Add or update a person at an account.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ct-acct" className="text-xs font-medium">Account *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="ct-acct"><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("ct-first", "First name *", firstName, setFirstName)}
            {field("ct-last", "Last name *", lastName, setLastName)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("ct-email", "Email", email, setEmail)}
            {field("ct-phone", "Phone", phone, setPhone)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("ct-title", "Job title", jobTitle, setJobTitle)}
            {field("ct-dept", "Department", department, setDepartment)}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Primary contact
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {contact ? "Save changes" : "Create contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function DealDialog({
  open,
  onOpenChange,
  deal,
  accounts,
  stages,
  defaultAccountId,
  defaultStageId,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deal?: Deal | null;
  accounts: Account[];
  stages: Stage[];
  defaultAccountId?: string;
  defaultStageId?: string;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  const [accountId, setAccountId] = useState(defaultAccountId ?? deal?.account_id ?? "");
  const [name, setName] = useState(deal?.name ?? "");
  const [amount, setAmount] = useState(deal ? String(deal.amount ?? 0) : "");
  const [currency, setCurrency] = useState(deal?.currency ?? "UGX");
  const [stageId, setStageId] = useState(defaultStageId ?? deal?.stage_id ?? "");
  const [priority, setPriority] = useState(deal?.priority ?? "medium");
  const [expectedClose, setExpectedClose] = useState(
    deal?.expected_close ? deal.expected_close.slice(0, 10) : ""
  );
  const [notes, setNotes] = useState(deal?.notes ?? "");

  useEffect(() => {
    if (open) {
      setAccountId(defaultAccountId ?? deal?.account_id ?? "");
      setName(deal?.name ?? "");
      setAmount(deal ? String(deal.amount ?? 0) : "");
      setCurrency(deal?.currency ?? "UGX");
      setStageId(defaultStageId ?? deal?.stage_id ?? "");
      setPriority(deal?.priority ?? "medium");
      setExpectedClose(deal?.expected_close ? deal.expected_close.slice(0, 10) : "");
      setNotes(deal?.notes ?? "");
    }
  }, [open, deal, defaultAccountId, defaultStageId]);

  const submit = async () => {
    if (!accountId) {
      toast.error("Select an account");
      return;
    }
    if (name.trim().length < 2) {
      toast.error("Deal name is required");
      return;
    }
    const data: Record<string, unknown> = {
      account_id: accountId,
      name: name.trim(),
      amount: amount === "" ? 0 : Number(amount),
      currency: currency || "UGX",
      stage_id: stageId || undefined,
      priority,
      expected_close: expectedClose || null,
      notes: notes.trim() || null,
    };
    await onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{deal ? "Edit deal" : "New deal"}</DialogTitle>
          <DialogDescription>Track an opportunity in the sales pipeline.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {field("dl-name", "Deal name *", name, setName)}
          <div className="space-y-1.5">
            <Label htmlFor="dl-acct" className="text-xs font-medium">Account *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="dl-acct"><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("dl-amount", "Amount", amount, setAmount, "0")}
            <div className="space-y-1.5">
              <Label htmlFor="dl-ccy" className="text-xs font-medium">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="dl-ccy"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UGX">UGX</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="KES">KES</SelectItem>
                  <SelectItem value="TZS">TZS</SelectItem>
                  <SelectItem value="RWF">RWF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dl-stage" className="text-xs font-medium">Stage</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger id="dl-stage"><SelectValue placeholder="Select stage" /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.probability}%)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dl-prio" className="text-xs font-medium">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="dl-prio"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {field("dl-close", "Expected close", expectedClose, setExpectedClose, "YYYY-MM-DD")}
          <div className="space-y-1.5">
            <Label htmlFor="dl-notes" className="text-xs font-medium">Notes</Label>
            <Textarea id="dl-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {deal ? "Save changes" : "Create deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivityDialog({
  open,
  onOpenChange,
  accounts,
  deals,
  defaultKind,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: Account[];
  deals: Deal[];
  defaultKind?: string;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  const [kind, setKind] = useState(defaultKind ?? "task");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [dealId, setDealId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [outcome, setOutcome] = useState("");

  useEffect(() => {
    if (open) {
      setKind(defaultKind ?? "task");
      setSubject("");
      setDescription("");
      setAccountId("");
      setDealId("");
      setDueAt("");
      setOutcome("");
    }
  }, [open, defaultKind]);

  const submit = async () => {
    if (subject.trim().length < 1) {
      toast.error("Subject is required");
      return;
    }
    const data: Record<string, unknown> = {
      kind,
      subject: subject.trim(),
      description: description.trim() || null,
      account_id: accountId || null,
      deal_id: dealId || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      outcome: outcome.trim() || null,
    };
    await onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New activity</DialogTitle>
          <DialogDescription>Log a call, meeting, email, task, or follow-up.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="act-kind" className="text-xs font-medium">Type</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="act-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {field("act-due", "Due", dueAt, setDueAt, "YYYY-MM-DD HH:mm")}
          </div>
          {field("act-subject", "Subject *", subject, setSubject)}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="act-acct" className="text-xs font-medium">Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="act-acct"><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act-deal" className="text-xs font-medium">Deal</Label>
              <Select value={dealId} onValueChange={setDealId}>
                <SelectTrigger id="act-deal"><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None</SelectItem>
                  {deals.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-desc" className="text-xs font-medium">Description</Label>
            <Textarea id="act-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {field("act-outcome", "Outcome", outcome, setOutcome)}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
/* ------------------------------------------------------------------ */
/* Pipeline (kanban) tab                                               */
/* ------------------------------------------------------------------ */

function PipelineTab({
  stages,
  deals,
  accounts,
  leads,
  reload,
}: {
  stages: Stage[];
  deals: Deal[];
  accounts: Account[];
  leads: Lead[];
  reload: () => Promise<void>;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [defaultStage, setDefaultStage] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [convertLeadId, setConvertLeadId] = useState("");
  const [converting, setConverting] = useState(false);

  const unconvertedLeads = useMemo(
    () => leads.filter((l) => l.status !== "converted"),
    [leads]
  );

  const moveDeal = async (dealId: string, stageId: string) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === stageId) return;
    try {
      await apiMutate("PATCH", { resource: "deals", id: dealId, data: { stage_id: stageId } });
      toast.success("Deal moved");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Move failed");
    }
  };

  const openNew = (stageId: string) => {
    setEditing(null);
    setDefaultStage(stageId);
    setEditorOpen(true);
  };

  const openEdit = (deal: Deal) => {
    setEditing(deal);
    setDefaultStage(undefined);
    setEditorOpen(true);
  };

  const saveDeal = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editing) {
        await apiMutate("PATCH", { resource: "deals", id: editing.id, data });
        toast.success("Deal updated");
      } else {
        await apiMutate("POST", { resource: "deals", data });
        toast.success("Deal created");
      }
      setEditorOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const convertLead = async () => {
    if (!convertLeadId) {
      toast.info("Select a lead to convert");
      return;
    }
    setConverting(true);
    try {
      const res = await apiMutate<{ deal: Deal }>("POST", {
        resource: "convert",
        data: { lead_id: convertLeadId },
      });
      toast.success(`Converted - ${res.deal.name}`);
      setConvertLeadId("");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-4">
      {unconvertedLeads.length > 0 && (
        <Card className="border-hope-teal/30 bg-hope-teal/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-sm font-semibold">Convert marketing leads into the pipeline</p>
              <p className="text-xs text-muted-foreground">
                {unconvertedLeads.length} lead{unconvertedLeads.length === 1 ? "" : "s"} not yet converted
              </p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <Select value={convertLeadId} onValueChange={setConvertLeadId}>
                <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Select lead" /></SelectTrigger>
                <SelectContent>
                  {unconvertedLeads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.company || l.name}{l.email ? ` - ${l.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={convertLead} disabled={converting || !convertLeadId}>
                {converting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-1 h-4 w-4" />}
                Convert
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage_id === stage.id);
          const columnValue = stageDeals.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
          return (
            <div
              key={stage.id}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border bg-card/60",
                overStage === stage.id && "border-hope-teal ring-2 ring-hope-teal/20"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage.id);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setOverStage(null);
                const id = e.dataTransfer.getData("text/deal-id") || dragId;
                if (id) void moveDeal(id, stage.id);
              }}
            >
              <div className="flex items-center justify-between border-b px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", STAGE_DOT[stage.color] ?? "bg-muted")} />
                  <span className="text-sm font-semibold">{stage.name}</span>
                  <Badge variant="secondary" className="ml-1">{stageDeals.length}</Badge>
                </div>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {formatMoney(columnValue)}
                </span>
              </div>
              <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-2">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(deal.id);
                      e.dataTransfer.setData("text/deal-id", deal.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => openEdit(deal)}
                    className={cn(
                      "cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-hope-teal/50 hover:shadow",
                      dragId === deal.id && "opacity-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug">{deal.name}</p>
                      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{deal.account_name ?? DASH}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-bold tabular-nums">{formatMoney(deal.amount, deal.currency)}</span>
                      <Badge variant={PRIORITY_VARIANT[deal.priority] ?? "secondary"} className="capitalize">
                        {deal.priority}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {deal.expected_close ? formatDate(deal.expected_close) : "No close date"}
                      </span>
                      <span className="tabular-nums">{deal.probability}%</span>
                    </div>
                  </div>
                ))}
                {!stageDeals.length && (
                  <p className="py-4 text-center text-xs text-muted-foreground">No deals</p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => openNew(stage.id)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add deal
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <DealDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        deal={editing}
        accounts={accounts}
        stages={stages}
        defaultStageId={defaultStage}
        onSave={saveDeal}
        saving={saving}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Accounts tab                                                        */
/* ------------------------------------------------------------------ */

function AccountsTab({
  accounts,
  deals,
  reload,
}: {
  accounts: Account[];
  deals: Deal[];
  reload: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.email ?? "").toLowerCase().includes(q) ||
        (a.industry ?? "").toLowerCase().includes(q) ||
        (a.country ?? "").toLowerCase().includes(q)
    );
  }, [accounts, search]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (a: Account) => {
    setEditing(a);
    setDialogOpen(true);
  };

  const saveAccount = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editing) {
        await apiMutate("PATCH", { resource: "accounts", id: editing.id, data });
        toast.success("Account updated");
      } else {
        await apiMutate("POST", { resource: "accounts", data });
        toast.success("Account created");
      }
      setDialogOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = async (a: Account) => {
    if (!confirm(`Delete account "${a.name}"? Contacts and deals will be preserved as orphans.`)) return;
    setBusyId(a.id);
    try {
      await apiMutate("DELETE", { resource: "accounts", id: a.id });
      toast.success("Account deleted");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const openDealCount = (accountId: string) =>
    deals.filter((d) => d.account_id === accountId && !isWon(d) && !isLost(d)).length;
  const openDealValue = (accountId: string) =>
    deals
      .filter((d) => d.account_id === accountId && !isWon(d) && !isLost(d))
      .reduce((acc, d) => acc + (Number(d.amount) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts..."
            className="pl-8"
          />
        </div>
        <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> New account</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No accounts" description="Create your first organization account." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Open deals</TableHead>
                  <TableHead className="text-right">Pipeline</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{a.email ?? DASH}</div>
                    </TableCell>
                    <TableCell className="text-sm">{a.industry ?? DASH}</TableCell>
                    <TableCell className="text-sm">{a.country ?? DASH}</TableCell>
                    <TableCell>
                      <Badge variant={ACCOUNT_STATUS_VARIANT[a.status] ?? "outline"} className="capitalize">{a.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{openDealCount(a.id)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(openDealValue(a.id))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)} title="Edit">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeAccount(a)}
                          disabled={busyId === a.id}
                          title="Delete"
                        >
                          {busyId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editing}
        onSave={saveAccount}
        saving={saving}
      />
    </div>
  );
}
/* ------------------------------------------------------------------ */
/* Contacts tab                                                        */
/* ------------------------------------------------------------------ */

function ContactsTab({
  contacts,
  accounts,
  reload,
}: {
  contacts: Contact[];
  accounts: Account[];
  reload: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [defaultAccountId, setDefaultAccountId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        fullName(c).toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.job_title ?? "").toLowerCase().includes(q) ||
        (c.account_name ?? "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const openNew = (accountId?: string) => {
    setEditing(null);
    setDefaultAccountId(accountId);
    setDialogOpen(true);
  };
  const openEdit = (c: Contact) => {
    setEditing(c);
    setDefaultAccountId(undefined);
    setDialogOpen(true);
  };

  const saveContact = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editing) {
        await apiMutate("PATCH", { resource: "contacts", id: editing.id, data });
        toast.success("Contact updated");
      } else {
        await apiMutate("POST", { resource: "contacts", data });
        toast.success("Contact created");
      }
      setDialogOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts..." className="pl-8" />
        </div>
        <Button onClick={() => openNew(undefined)}><Plus className="mr-1 h-4 w-4" /> New contact</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Contact} title="No contacts" description="Add contacts to your accounts." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Job title</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        {fullName(c)}
                        {c.is_primary && <Badge variant="outline">Primary</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{c.account_name ?? DASH}</TableCell>
                    <TableCell className="text-sm">{c.job_title ?? DASH}</TableCell>
                    <TableCell className="text-sm">{c.email ?? DASH}</TableCell>
                    <TableCell className="text-sm">{c.phone ?? DASH}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} title="Edit">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editing}
        accounts={accounts}
        defaultAccountId={defaultAccountId}
        onSave={saveContact}
        saving={saving}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deals tab                                                           */
/* ------------------------------------------------------------------ */

function DealsTab({
  deals,
  stages,
  accounts,
  reload,
}: {
  deals: Deal[];
  stages: Stage[];
  accounts: Account[];
  reload: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("open");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((d) => {
      if (scope === "open" && (isWon(d) || isLost(d))) return false;
      if (scope === "won" && !isWon(d)) return false;
      if (scope === "lost" && !isLost(d)) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        (d.account_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [deals, search, scope]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (d: Deal) => {
    setEditing(d);
    setDialogOpen(true);
  };

  const saveDeal = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editing) {
        await apiMutate("PATCH", { resource: "deals", id: editing.id, data });
        toast.success("Deal updated");
      } else {
        await apiMutate("POST", { resource: "deals", data });
        toast.success("Deal created");
      }
      setDialogOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const moveStage = async (dealId: string, stageId: string) => {
    setBusyId(dealId);
    try {
      await apiMutate("PATCH", { resource: "deals", id: dealId, data: { stage_id: stageId } });
      toast.success("Stage updated");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const removeDeal = async (d: Deal) => {
    if (!confirm(`Delete deal "${d.name}"?`)) return;
    setBusyId(d.id);
    try {
      await apiMutate("DELETE", { resource: "deals", id: d.id });
      toast.success("Deal deleted");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deals..." className="pl-8" />
          </div>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> New deal</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Target} title="No deals" description="Create your first opportunity." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Expected close</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{isWon(d) ? "Won" : isLost(d) ? "Lost" : `${d.probability}% probability`}</div>
                    </TableCell>
                    <TableCell className="text-sm">{d.account_name ?? DASH}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select value={d.stage_id} onValueChange={(v) => void moveStage(d.id, v)} disabled={busyId === d.id}>
                          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {stages.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium tabular-nums">{formatMoney(d.amount, d.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={PRIORITY_VARIANT[d.priority] ?? "secondary"} className="capitalize">{d.priority}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{d.expected_close ? formatDate(d.expected_close) : DASH}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)} title="Edit">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeDeal(d)}
                          disabled={busyId === d.id}
                          title="Delete"
                        >
                          {busyId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <DealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        deal={editing}
        accounts={accounts}
        stages={stages}
        onSave={saveDeal}
        saving={saving}
      />
    </div>
  );
}
/* ------------------------------------------------------------------ */
/* Activities tab                                                      */
/* ------------------------------------------------------------------ */

function ActivitiesTab({
  activities,
  accounts,
  deals,
  reload,
}: {
  activities: Activity[];
  accounts: Account[];
  deals: Deal[];
  reload: () => Promise<void>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultKind, setDefaultKind] = useState<string | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);

  const upcoming = useMemo(
    () =>
      activities
        .filter((a) => !a.done && a.due_at)
        .sort((a, b) => new Date(String(a.due_at)).getTime() - new Date(String(b.due_at)).getTime()),
    [activities]
  );
  const recent = useMemo(
    () => activities.filter((a) => a.done || !a.due_at).slice(0, 40),
    [activities]
  );

  const openNew = (kind: string) => {
    setDefaultKind(kind);
    setDialogOpen(true);
  };

  const saveActivity = async (data: Record<string, unknown>) => {
    try {
      await apiMutate("POST", { resource: "activities", data });
      toast.success("Activity created");
      setDialogOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const toggleDone = async (a: Activity) => {
    setBusyId(a.id);
    try {
      await apiMutate("PATCH", { resource: "activities", id: a.id, data: { done: !a.done } });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(["task", "follow_up", "call", "meeting", "email", "note"] as const).map((kind) => (
          <Button key={kind} variant="outline" size="sm" onClick={() => openNew(kind)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> {KIND_LABEL[kind] ?? kind}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold">
            Upcoming tasks &amp; follow-ups
            {upcoming.length > 0 && <Badge variant="secondary" className="ml-2">{upcoming.length}</Badge>}
          </h3>
          {upcoming.length === 0 ? (
            <EmptyState icon={BellRing} title="All clear" description="No open tasks or follow-ups." />
          ) : (
            <div className="space-y-2">
              {upcoming.map((a) => {
                const days = daysUntil(a.due_at);
                const overdue = days !== null && days < 0;
                const Icon = KIND_ICON[a.kind] ?? StickyNote;
                return (
                  <Card key={a.id}>
                    <CardContent className="flex items-start gap-3 p-3">
                      <button
                        onClick={() => toggleDone(a)}
                        disabled={busyId === a.id}
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                          overdue ? "border-rose-400 text-rose-400" : "border-muted-foreground/40 text-transparent hover:text-hope-teal"
                        )}
                        title={a.done ? "Mark open" : "Mark done"}
                      >
                        {busyId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{a.subject}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {a.account_name ?? a.deal_name ?? "General"}
                          {a.due_at ? ` - ${formatDateTime(a.due_at)}` : ""}
                        </p>
                        {a.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
                      </div>
                      <Badge variant={overdue ? "destructive" : "outline"} className="shrink-0">
                        {overdue ? "Overdue" : days === 0 ? "Today" : `${days}d`}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Recent activity</h3>
          {recent.length === 0 ? (
            <EmptyState icon={Clock} title="No activity yet" description="Log calls, notes, and emails as you work deals." />
          ) : (
            <div className="space-y-2">
              {recent.map((a) => {
                const Icon = KIND_ICON[a.kind] ?? StickyNote;
                return (
                  <Card key={a.id}>
                    <CardContent className="flex items-start gap-3 p-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium leading-snug">{a.subject}</p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(a.created_at)}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <Badge variant="outline" className="mr-2">{KIND_LABEL[a.kind] ?? a.kind}</Badge>
                          {a.account_name ?? a.deal_name ?? "General"}
                        </p>
                        {a.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ActivityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accounts={accounts}
        deals={deals}
        defaultKind={defaultKind}
        onSave={saveActivity}
        saving={false}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Templates tab                                                       */
/* ------------------------------------------------------------------ */

function TemplatesTab({ templates }: { templates: Template[] }) {
  if (templates.length === 0) {
    return <EmptyState icon={Mail} title="No templates" description="Email templates will appear here." />;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => (
        <Card key={t.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">{t.name}</CardTitle>
              {t.is_default && <Badge variant="outline">Default</Badge>}
            </div>
            <p className="text-xs text-muted-foreground capitalize">{t.category}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs font-medium text-hope-teal">Subject: {t.subject}</p>
            <p className="whitespace-pre-line text-xs text-muted-foreground line-clamp-6">{t.body}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PlatformCrmPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Overview | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/platform/crm?resource=overview");
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Failed to load CRM");
      }
      setData((json.data ?? json) as Overview);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales CRM"
        description="Accounts, pipeline, opportunities, activities, and email templates."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw className={cn("mr-1 h-3.5 w-3.5", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        }
      />

      {loading || !data ? (
        <LoadingState message="Loading CRM..." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Open pipeline"
              value={formatMoney(stats?.pipeline_value)}
              description={`${stats?.open_deals ?? 0} open deals`}
              icon={DollarSign}
            />
            <StatCard
              title="Weighted pipeline"
              value={formatMoney(stats?.weighted_pipeline)}
              description="Probability-adjusted forecast"
              icon={TrendingUp}
            />
            <StatCard
              title="Won (30 days)"
              value={formatMoney(stats?.won_value_30d)}
              description={`${stats?.won_deals ?? 0} won · ${stats?.conversion_rate ?? 0}% conversion`}
              icon={CircleDollarSign}
            />
            <StatCard
              title="Open tasks"
              value={`${stats?.pending_tasks ?? 0}`}
              description={`${stats?.due_today ?? 0} due today · ${stats?.overdue_tasks ?? 0} overdue`}
              icon={Clock}
            />
            <StatCard
              title="Accounts"
              value={stats?.accounts_count ?? 0}
              description={`${stats?.contacts_count ?? 0} contacts`}
              icon={Building2}
            />
            <StatCard
              title="Deals"
              value={stats?.deals_count ?? 0}
              description={`${stats?.won_deals ?? 0} won · ${stats?.lost_deals ?? 0} lost`}
              icon={Target}
            />
            <StatCard
              title="Avg deal size (won)"
              value={formatMoney(stats?.avg_deal_size)}
              description="Historical average"
              icon={CircleDollarSign}
            />
            <StatCard
              title="Email templates"
              value={stats?.templates_count ?? 0}
              description="Reusable outreach templates"
              icon={Mail}
            />
          </div>

          <Tabs defaultValue="pipeline">
            <TabsList className="flex-wrap">
              <TabsTrigger value="pipeline"><Kanban className="mr-1.5 h-3.5 w-3.5" />Pipeline</TabsTrigger>
              <TabsTrigger value="accounts"><Building2 className="mr-1.5 h-3.5 w-3.5" />Accounts</TabsTrigger>
              <TabsTrigger value="contacts"><Contact className="mr-1.5 h-3.5 w-3.5" />Contacts</TabsTrigger>
              <TabsTrigger value="deals"><Target className="mr-1.5 h-3.5 w-3.5" />Deals</TabsTrigger>
              <TabsTrigger value="activities"><BellRing className="mr-1.5 h-3.5 w-3.5" />Activities</TabsTrigger>
              <TabsTrigger value="templates"><Mail className="mr-1.5 h-3.5 w-3.5" />Templates</TabsTrigger>
            </TabsList>
            <TabsContent value="pipeline" className="mt-4">
              <PipelineTab
                stages={data.stages}
                deals={data.deals}
                accounts={data.accounts}
                leads={data.leads}
                reload={() => load(true)}
              />
            </TabsContent>
            <TabsContent value="accounts" className="mt-4">
              <AccountsTab accounts={data.accounts} deals={data.deals} reload={() => load(true)} />
            </TabsContent>
            <TabsContent value="contacts" className="mt-4">
              <ContactsTab contacts={data.contacts} accounts={data.accounts} reload={() => load(true)} />
            </TabsContent>
            <TabsContent value="deals" className="mt-4">
              <DealsTab deals={data.deals} stages={data.stages} accounts={data.accounts} reload={() => load(true)} />
            </TabsContent>
            <TabsContent value="activities" className="mt-4">
              <ActivitiesTab
                activities={data.activities}
                accounts={data.accounts}
                deals={data.deals}
                reload={() => load(true)}
              />
            </TabsContent>
            <TabsContent value="templates" className="mt-4">
              <TemplatesTab templates={data.templates} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}