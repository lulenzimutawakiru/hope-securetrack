"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Download,
  Filter,
  Inbox,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  User,
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
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  INDUSTRY_OPTIONS,
  COUNTRY_OPTIONS,
  countryLabel,
} from "@/lib/marketing/lead-options";

const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "closed"] as const;

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  closed: "Closed",
};

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "default" | "destructive"> = {
  new: "outline",
  contacted: "secondary",
  qualified: "default",
  converted: "secondary",
  closed: "outline",
};

type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  industry?: string | null;
  country?: string | null;
  company_size?: string | null;
  preferred_contact_method?: string | null;
  message?: string | null;
  source?: string | null;
  status: string;
  lead_score?: number | null;
  follow_up_at?: string | null;
  assigned_to?: string | null;
  attachment_path?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

type Stats = {
  total: number;
  by_status: Record<string, number>;
  by_industry: Record<string, number>;
  by_country: Record<string, number>;
  by_source: Record<string, number>;
  by_company_size: Record<string, number>;
  avg_lead_score: number;
  pending_follow_ups: number;
};

const EMPTY_STATS: Stats = {
  total: 0,
  by_status: {},
  by_industry: {},
  by_country: {},
  by_source: {},
  by_company_size: {},
  avg_lead_score: 0,
  pending_follow_ups: 0,
};

const DASH = "\u2014";
const BULLET = "\u2022";

function formatDate(value?: string | null) {
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

function sizeLabel(value?: string | null) {
  if (!value) return DASH;
  const match = [
    { value: "1-50", label: "1-50 emp" },
    { value: "51-200", label: "51-200 emp" },
    { value: "201-1000", label: "201-1000 emp" },
    { value: "1000+", label: "1000+ emp" },
  ].find((o) => o.value === value);
  return match ? match.label : value;
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!entries.length) return null;
  const max = Math.max(...entries.map(([, n]) => n), 1);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map(([key, n]) => (
          <div key={key}>
            <div className="mb-0.5 flex items-center justify-between text-xs">
              <span className="truncate pr-2">{key}</span>
              <span className="font-medium tabular-nums">{n}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-hope-teal transition-all"
                style={{ width: `${Math.round((n / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function PlatformLeadsPage() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [industry, setIndustry] = useState<string>("all");
  const [country, setCountry] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [selected, setSelected] = useState<Lead | null>(null);
  const [detailStatus, setDetailStatus] = useState<string>("new");
  const [followUp, setFollowUp] = useState("");
  const [note, setNote] = useState("");
  const [savingDetail, setSavingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      if (status !== "all") qs.set("status", status);
      if (industry !== "all") qs.set("industry", industry);
      if (country !== "all") qs.set("country", country);
      qs.set("limit", "500");
      const res = await fetch(`/api/platform/leads?${qs}`);
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Failed to load leads");
      }
      const data = json.data ?? json;
      setLeads(data.leads ?? []);
      setStats(data.stats ?? EMPTY_STATS);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [search, status, industry, country]);

  useEffect(() => {
    load();
  }, [load]);

  const patchLead = async (id: string, payload: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/platform/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Update failed");
      }
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
      return false;
    }
  };

  const quickStatus = async (lead: Lead, next: string) => {
    setBusyId(lead.id);
    try {
      const ok = await patchLead(lead.id, { id: lead.id, status: next });
      if (ok) {
        toast.success(`Lead moved to ${STATUS_LABEL[next] ?? next}`);
        await load();
      }
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = (lead: Lead) => {
    setSelected(lead);
    setDetailStatus(lead.status);
    setFollowUp(
      lead.follow_up_at ? new Date(lead.follow_up_at).toISOString().slice(0, 16) : ""
    );
    setNote("");
  };

  const saveDetail = async () => {
    if (!selected) return;
    setSavingDetail(true);
    try {
      const payload: Record<string, unknown> = { id: selected.id };
      if (detailStatus !== selected.status) payload.status = detailStatus;
      if (followUp) {
        const iso = new Date(followUp).toISOString();
        if (iso !== selected.follow_up_at) payload.followUpAt = iso;
      } else if (selected.follow_up_at) {
        payload.followUpAt = null;
      }
      if (note.trim()) payload.note = note.trim();
      if (Object.keys(payload).length <= 1) {
        toast.info("No changes to save");
        return;
      }
      const ok = await patchLead(selected.id, payload);
      if (ok) {
        toast.success("Lead updated");
        setSelected(null);
        await load();
      }
    } finally {
      setSavingDetail(false);
    }
  };

  const exportCsv = () => {
    if (!leads.length) {
      toast.info("Nothing to export");
      return;
    }
    const header = [
      "name", "email", "phone", "company", "industry", "country",
      "company_size", "preferred_contact_method", "status", "lead_score",
      "follow_up_at", "source", "utm_source", "utm_medium", "utm_campaign",
      "referrer", "created_at", "message",
    ];
    const rows = leads.map((l) => {
      const m = (l.metadata ?? {}) as Record<string, unknown>;
      return [
        l.name, l.email, l.phone ?? "", l.company ?? "", l.industry ?? "",
        l.country ?? "", l.company_size ?? "", l.preferred_contact_method ?? "",
        l.status, l.lead_score ?? 0, l.follow_up_at ?? "", l.source ?? "",
        m.utm_source ?? "", m.utm_medium ?? "", m.utm_campaign ?? "",
        m.referrer ?? "", l.created_at ?? "", l.message ?? "",
      ];
    });
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [header, ...rows]
      .map((r) => r.map(escape).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `securetrack-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${leads.length} leads`);
  };

  const pendingCount = useMemo(
    () =>
      leads.filter(
        (l) => l.follow_up_at && new Date(l.follow_up_at) > new Date()
      ).length,
    [leads]
  );

  const conversionRate = stats.total
    ? Math.round(((stats.by_status.converted ?? 0) / stats.total) * 100)
    : 0;

  if (loading && leads.length === 0) {
    return <LoadingState message="Loading leads & CRM\u2026" />;
  }

  return (
    <div>
      <PageHeader
        title="Leads & CRM"
        description="Marketing site leads, qualification pipeline, follow-ups, and source analytics"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!leads.length}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total leads (filtered)"
          value={stats.total}
          icon={Inbox}
          description={
            `${leads.filter((l) => l.status === "new").length} awaiting first contact`
          }
        />
        <StatCard
          title="Avg lead score"
          value={stats.avg_lead_score}
          icon={Sparkles}
          description="0-100 \u00b7 attachment + detail weighted"
        />
        <StatCard
          title="Pending follow-ups"
          value={pendingCount}
          icon={CalendarClock}
          description={stats.pending_follow_ups ? "Upcoming scheduled touches" : "None scheduled"}
        />
        <StatCard
          title="Conversion rate"
          value={`${conversionRate}%`}
          icon={User}
          description={
            `${stats.by_status.converted ?? 0} converted \u00b7 ${stats.by_status.closed ?? 0} closed`
          }
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {["all", ...LEAD_STATUSES].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? "default" : "outline"}
            className={cn(status === s && "bg-hope-teal text-hope-ink hover:bg-hope-teal/90")}
            onClick={() => setStatus(s)}
          >
            {s === "all" ? "All" : STATUS_LABEL[s]}
          </Button>
        ))}
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, email, company\u2026"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All industries</SelectItem>
            {INDUSTRY_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {COUNTRY_OPTIONS.map((o) => (
              <SelectItem key={o.code} value={o.code}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={load}>
          <Filter className="h-4 w-4 mr-1" /> Apply
        </Button>
      </div>

      {!leads.length ? (
        <EmptyState
          icon={MessageSquare}
          title="No leads match"
          description="Submissions from the marketing site contact form appear here with pipeline, scoring, and attribution."
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Industry / Country</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <button
                      className="text-left font-medium hover:text-primary hover:underline"
                      onClick={() => openDetail(l)}
                    >
                      {l.name}
                    </button>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[14rem]">
                      {l.email}
                      {l.phone ? ` \u00b7 ${l.phone}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.company || DASH}
                    <p className="text-[11px] text-muted-foreground">
                      {sizeLabel(l.company_size)} {l.source ? ` \u00b7 ${l.source}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.industry || DASH}
                    <p className="text-[11px] text-muted-foreground">{countryLabel(l.country)}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={Number(l.lead_score) >= 60 ? "secondary" : "outline"}
                      className="text-[10px] tabular-nums"
                    >
                      {l.lead_score ?? 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_VARIANT[l.status] ?? "outline"}
                      className="text-[10px] capitalize"
                    >
                      {STATUS_LABEL[l.status] ?? l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.follow_up_at ? formatDate(l.follow_up_at) : DASH}
                  </TableCell>
                  <TableCell className="text-right">
                    <Select
                      value={l.status}
                      onValueChange={(v) => quickStatus(l, v)}
                      disabled={busyId === l.id}
                    >
                      <SelectTrigger className="ml-auto h-8 w-32 text-xs">
                        <SelectValue placeholder="Move" />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
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

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Breakdown title="Pipeline by status" data={stats.by_status} />
        <Breakdown title="By industry" data={stats.by_industry} />
        <Breakdown title="By country" data={stats.by_country} />
        <Breakdown title="By source" data={stats.by_source} />
        <Breakdown title="By company size" data={stats.by_company_size} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lead insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>
              {BULLET} High-value signals: phone, company size, country, detailed message, and
              attachments each raise the lead score.
            </p>
            <p>
              {BULLET} Attribution: UTM parameters, referrer, and user agent are captured on
              every marketing-site submission.
            </p>
            <p>
              {BULLET} Follow-ups scheduled from this page generate the pending follow-up count.
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              {selected?.company || "Individual"}
              {" \u00b7 "}
              {countryLabel(selected?.country)}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <Label className="text-[11px] text-muted-foreground">Contact</Label>
                  <p className="mt-1 text-sm font-medium">{selected.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.phone || "No phone"}
                    {selected.preferred_contact_method
                      ? ` \u00b7 prefers ${selected.preferred_contact_method.replace("_", " ")}`
                      : ""}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <Label className="text-[11px] text-muted-foreground">Profile</Label>
                  <p className="mt-1 text-sm">
                    {selected.industry || DASH}
                    {" \u00b7 "}
                    {sizeLabel(selected.company_size)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Score {selected.lead_score ?? 0}/100
                    {" \u00b7 "}
                    {formatDate(selected.created_at)}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <Label className="text-[11px] text-muted-foreground">Message</Label>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {selected.message || DASH}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <Label className="text-[11px] text-muted-foreground">Attribution</Label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(() => {
                    const m = (selected.metadata ?? {}) as Record<string, unknown>;
                    const chips = [
                      m.utm_source ? `utm: ${m.utm_source}` : null,
                      m.utm_medium ? ` / ${m.utm_medium}` : null,
                      m.utm_campaign ? ` \u00b7 ${m.utm_campaign}` : null,
                      m.referrer ? `referrer: ${String(m.referrer).slice(0, 60)}` : null,
                      m.email_status ? `email: ${m.email_status}` : null,
                      selected.attachment_path ? "attachment: yes" : null,
                    ].filter(Boolean);
                    return chips.length ? (
                      chips.map((c, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] font-normal">
                          {c}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No attribution captured
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Pipeline stage</Label>
                  <Select value={detailStatus} onValueChange={setDetailStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Follow-up (optional)</Label>
                  <Input
                    type="datetime-local"
                    className="mt-1"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label>Activity note (optional)</Label>
                <Textarea
                  className="mt-1 min-h-20"
                  placeholder="e.g. Called John - interested in a manufacturing demo next week..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button
              className="bg-hope-teal text-hope-ink hover:bg-hope-teal/90"
              onClick={saveDetail}
              disabled={savingDetail}
            >
              {savingDetail ? "Saving\u2026" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}