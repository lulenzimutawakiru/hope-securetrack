"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Receipt,
  FileText,
  Users,
  CreditCard,
  RefreshCw,
  Percent,
  Palette,
  Wand2,
  Hash,
  BarChart3,
  AlertTriangle,
  ArrowRight,
  Landmark,
  Repeat,
  FileMinus,
  FilePlus,
  Banknote,
  Scale,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
import { REVENUE_LIFECYCLE, agingBucket } from "@/lib/billing";

const MODULES = [
  { title: "CFO Dashboard", href: "/dashboard/billing/cfo", icon: Landmark, desc: "Revenue · AR · forecast · AI risk" },
  { title: "Invoices", href: "/dashboard/billing/invoices", icon: FileText, desc: "Create · approve · send · print" },
  { title: "Approvals", href: "/dashboard/billing/approvals", icon: Scale, desc: "Finance → Manager → Director → CEO" },
  { title: "Customers", href: "/dashboard/billing/customers", icon: Users, desc: "Billing profiles · credit · tax IDs" },
  { title: "Credit Control", href: "/dashboard/billing/credit", icon: AlertTriangle, desc: "Limits · blocks · approvals" },
  { title: "Payments", href: "/dashboard/billing/payments", icon: CreditCard, desc: "Cash · MoMo · cheque · POS · wallet" },
  { title: "Gateways", href: "/dashboard/billing/gateways", icon: Banknote, desc: "MTN · Stripe · PayPal · Flutterwave" },
  { title: "Recurring", href: "/dashboard/billing/recurring", icon: Repeat, desc: "Subscriptions · auto-invoice" },
  { title: "Contracts / SLA", href: "/dashboard/billing/contracts", icon: FileText, desc: "Milestones · retainers · maintenance" },
  { title: "Projects", href: "/dashboard/billing/projects", icon: Users, desc: "T&M · labor · expenses" },
  { title: "Manufacturing", href: "/dashboard/billing/manufacturing", icon: RefreshCw, desc: "Dispatch · batch · warranty" },
  { title: "Credit Notes", href: "/dashboard/billing/credit-notes", icon: FileMinus, desc: "Returns · adjustments" },
  { title: "Debit Notes", href: "/dashboard/billing/debit-notes", icon: FilePlus, desc: "Extra charges · corrections" },
  { title: "Tax", href: "/dashboard/billing/tax", icon: Percent, desc: "VAT · WHT · exemptions" },
  { title: "Aging / AR", href: "/dashboard/billing/aging", icon: Scale, desc: "Collections · buckets" },
  { title: "Customer Portal", href: "/dashboard/billing/portal", icon: Users, desc: "Access links · disputes" },
  { title: "Communications", href: "/dashboard/billing/communications", icon: Wand2, desc: "Email · SMS · WhatsApp" },
  { title: "Designer", href: "/dashboard/billing/designer", icon: Palette, desc: "Invoice templates" },
  { title: "AI Assistant", href: "/dashboard/billing/ai", icon: Wand2, desc: "Draft · fraud · collections" },
  { title: "Numbering", href: "/dashboard/billing/numbering", icon: Hash, desc: "HDG-INV-2026-######" },
  { title: "Reminders", href: "/dashboard/billing/reminders", icon: AlertTriangle, desc: "Dunning · overdue" },
  { title: "Revenue", href: "/dashboard/billing/revenue", icon: Landmark, desc: "Recognition schedules" },
  { title: "Reconcile", href: "/dashboard/billing/reconcile", icon: RefreshCw, desc: "Bank match · receipts" },
  { title: "Statements", href: "/dashboard/billing/statements", icon: FileText, desc: "Customer account ledger" },
  { title: "Reports", href: "/dashboard/billing/reports", icon: BarChart3, desc: "Sales · tax · collections" },
];

export default function BillingHubPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    invoices: 0,
    openAr: 0,
    overdue: 0,
    paidMtd: 0,
    draft: 0,
    customers: 0,
    recurring: 0,
    payments: 0,
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const startMonth = new Date();
      startMonth.setDate(1);
      const startIso = startMonth.toISOString().slice(0, 10);

      const [invCount, customers, recurring, payments, { data: openInvs }, { data: paidPays }] =
        await Promise.all([
          supabase.from("invoices").select("*", { count: "exact", head: true }),
          supabase.from("customers").select("*", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("bill_recurring_schedules").select("*", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("invoice_payments").select("*", { count: "exact", head: true }),
          supabase
            .from("invoices")
            .select("total_amount,amount_paid,due_date,status")
            .not("status", "in", '("paid","void","cancelled")')
            .limit(2000),
          supabase
            .from("invoice_payments")
            .select("amount")
            .gte("payment_date", startIso),
        ]);

      const list = openInvs || [];
      const openAr = list.reduce(
        (s, i) => s + (Number(i.total_amount) - Number(i.amount_paid || 0)),
        0
      );
      const overdue = list.filter((i) => agingBucket(i.due_date, String(i.status)) !== "current" && agingBucket(i.due_date, String(i.status)) !== "paid").length;
      const draft = list.filter((i) => i.status === "draft").length;
      const paidMtd = (paidPays || []).reduce((s, p) => s + Number(p.amount || 0), 0);

      setStats({
        invoices: invCount.count ?? 0,
        openAr,
        overdue,
        paidMtd,
        draft,
        customers: customers.count ?? 0,
        recurring: recurring.count ?? 0,
        payments: payments.count ?? 0,
      });
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading enterprise billing platform…" />;

  return (
    <div>
      <PageHeader
        title="Enterprise Invoicing & Billing"
        description="Invoice management · AR · tax · payments · recurring · revenue · multi-company"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/finance/ar">Finance AR</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/billing/ai">
                <Wand2 className="h-4 w-4 mr-1" /> AI Draft
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/billing/invoices">
                <Receipt className="h-4 w-4 mr-1" /> New Invoice
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {REVENUE_LIFECYCLE.map((s) => (
          <Badge key={s} variant="outline" className="text-[10px] font-normal">
            {s}
          </Badge>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Open AR" value={formatNumber(Math.round(stats.openAr))} icon={Scale} />
        <StatCard title="Invoices" value={String(stats.invoices)} icon={FileText} />
        <StatCard title="Overdue" value={String(stats.overdue)} icon={AlertTriangle} />
        <StatCard title="Collected MTD" value={formatNumber(Math.round(stats.paidMtd))} icon={CreditCard} />
        <StatCard title="Draft" value={String(stats.draft)} icon={FileText} />
        <StatCard title="Customers" value={String(stats.customers)} icon={Users} />
        <StatCard title="Recurring" value={String(stats.recurring)} icon={Repeat} />
        <StatCard title="Payments" value={String(stats.payments)} icon={Banknote} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
        {MODULES.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="h-full transition hover:border-teal-600/40 hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <m.icon className="h-5 w-5 text-teal-700" />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle className="text-base">{m.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{m.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform capabilities</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          <p>• Standard / tax / proforma / export / commercial invoices</p>
          <p>• Credit & debit notes with application tracking</p>
          <p>• Auto-invoice from sales orders</p>
          <p>• VAT, WHT, zero-rated, exempt tax codes</p>
          <p>• MTN MoMo · Airtel · bank · card gateways</p>
          <p>• Recurring subscriptions & maintenance billing</p>
          <p>• Aging buckets · dunning reminders</p>
          <p>• Invoice designer templates + QR</p>
          <p>• AI draft, pricing hints, error detection</p>
          <p>• Multi-currency · multi-branch numbering</p>
          <p>• Revenue recognition schedules</p>
          <p>• Bank reconciliation batches</p>
        </CardContent>
      </Card>
    </div>
  );
}
