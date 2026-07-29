"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, RefreshCw, ExternalLink, FileText, ListOrdered, Milestone,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { getContractDetail, type UnifiedContract } from "@/lib/contracts";
import { CONTRACT_DOMAINS, type ContractDomain } from "@/lib/contracts/types";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

const DOMAINS = new Set(["sales", "billing", "crm", "procurement", "government"]);

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const domain = String(params?.domain || "") as ContractDomain;
  const id = String(params?.id || "");
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<UnifiedContract | null>(null);
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null);
  const [lines, setLines] = useState<Array<Record<string, unknown>>>([]);
  const [milestones, setMilestones] = useState<Array<Record<string, unknown>>>([]);

  const meta = CONTRACT_DOMAINS.find((d) => d.key === domain);

  const load = async () => {
    if (!DOMAINS.has(domain) || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getContractDetail(domain, id);
      if (!data) {
        setContract(null);
        return;
      }
      setContract(data.contract);
      setRaw(data.raw);
      setLines(data.lines);
      setMilestones(data.milestones);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load contract");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [domain, id]);

  if (loading) return <LoadingState message="Loading contract…" />;

  if (!meta || !contract || !raw) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Contract not found.</p>
        <Button variant="outline" asChild>
          <Link href="/dashboard/contracts">Back to hub</Link>
        </Button>
      </div>
    );
  }

  const customers = raw.customers as { name?: string; code?: string; email?: string; phone?: string } | null;
  const suppliers = raw.suppliers as { name?: string; code?: string; email?: string; phone?: string } | null;

  return (
    <div>
      <PageHeader
        title={contract.title}
        description={`${contract.contract_number} · ${meta.title}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button size="sm" variant="outline" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={meta.legacyHref}>
                <ExternalLink className="h-4 w-4 mr-1" /> Module view
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6">
        <Badge variant={contract.status === "active" ? "default" : "secondary"}>
          {contract.status}
        </Badge>
        <Badge variant="outline" className="capitalize">
          {contract.domain}
        </Badge>
        <Badge variant="outline" className="capitalize">
          {contract.contract_type.replace(/_/g, " ")}
        </Badge>
        <Badge variant="secondary">
          {formatNumber(contract.value)} {contract.currency}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" /> Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                ["Contract #", contract.contract_number],
                ["Party", contract.party],
                ["Type", contract.contract_type],
                ["Status", contract.status],
                ["Start", contract.start_date ? formatDate(contract.start_date) : "—"],
                ["End", contract.end_date ? formatDate(contract.end_date) : "—"],
                ["Value", `${formatNumber(contract.value)} ${contract.currency}`],
                ["Currency", contract.currency],
              ].map((row) => {
                const k = String(row[0]);
                const v = String(row[1] ?? "—");
                return (
                <div key={k} className="rounded-lg border px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
                  <p className="font-medium mt-0.5 break-all">{v}</p>
                </div>
                );
              })}
              {raw.notes || raw.terms || raw.sla_summary ? (
                <div className="sm:col-span-2 rounded-lg border px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Terms / notes
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                    {String(raw.notes || raw.terms || raw.sla_summary)}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {domain === "sales" && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ListOrdered className="h-4 w-4" /> Contract lines
                </CardTitle>
                <Button size="sm" variant="ghost" asChild>
                  <Link href="/dashboard/sales/contract-lines">Manage lines</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No lines on this contract.</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Line</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Committed</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((l) => (
                          <TableRow key={String(l.id)}>
                            <TableCell className="font-mono text-xs">{String(l.line_code)}</TableCell>
                            <TableCell className="text-sm">
                              {String(l.product_name || l.product_code || "—")}
                            </TableCell>
                            <TableCell className="text-right">{String(l.quantity)}</TableCell>
                            <TableCell className="text-right">
                              {formatNumber(Number(l.unit_price || 0))}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(Number(l.committed_value || 0))}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{String(l.status)}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {domain === "billing" && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Milestone className="h-4 w-4" /> Milestones
                </CardTitle>
                <Button size="sm" variant="ghost" asChild>
                  <Link href="/dashboard/billing/contracts">Billing module</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {milestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No milestones.</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">% Done</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {milestones.map((m) => (
                          <TableRow key={String(m.id)}>
                            <TableCell className="font-mono text-xs">
                              {String(m.milestone_code || "—")}
                            </TableCell>
                            <TableCell className="text-sm">{String(m.name)}</TableCell>
                            <TableCell className="text-xs">
                              {m.due_date ? formatDate(String(m.due_date)) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(Number(m.amount || 0))}
                            </TableCell>
                            <TableCell className="text-right">
                              {String(m.percent_complete ?? 0)}%
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{String(m.status)}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Counterparty</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{contract.party}</p>
              {customers && (
                <>
                  {customers.code ? (
                    <p className="text-xs text-muted-foreground">Code: {customers.code}</p>
                  ) : null}
                  {customers.email ? (
                    <p className="text-xs text-muted-foreground">{customers.email}</p>
                  ) : null}
                  {customers.phone ? (
                    <p className="text-xs text-muted-foreground">{customers.phone}</p>
                  ) : null}
                </>
              )}
              {suppliers && (
                <>
                  {suppliers.code ? (
                    <p className="text-xs text-muted-foreground">Code: {suppliers.code}</p>
                  ) : null}
                  {suppliers.email ? (
                    <p className="text-xs text-muted-foreground">{suppliers.email}</p>
                  ) : null}
                </>
              )}
              {domain === "billing" && (
                <div className="pt-2 border-t text-xs space-y-1">
                  <p>Billing: {String(raw.billing_method || "—")} / {String(raw.billing_frequency || "—")}</p>
                  <p>Billed to date: {formatNumber(Number(raw.billed_to_date || 0))}</p>
                  <p>Next bill: {raw.next_bill_date ? formatDate(String(raw.next_bill_date)) : "—"}</p>
                </div>
              )}
              {domain === "sales" && (
                <div className="pt-2 border-t text-xs space-y-1">
                  <p>Consumed: {formatNumber(Number(raw.consumed_value || 0))}</p>
                  <p>Payment terms: {String(raw.payment_terms_days ?? "—")} days</p>
                  <p>Price list: {String(raw.price_list_code || "—")}</p>
                  <p>Owner: {String(raw.owner_name || "—")}</p>
                </div>
              )}
              {domain === "government" && (
                <div className="pt-2 border-t text-xs space-y-1">
                  <p>Billed to date: {formatNumber(Number(raw.billed_to_date || 0))}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Drill paths</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <Link href="/dashboard/contracts" className="block text-primary hover:underline">
                ← Contracts hub
              </Link>
              <Link href={meta.href} className="block text-primary hover:underline">
                {meta.title} list
              </Link>
              <Link href={meta.legacyHref} className="block text-primary hover:underline">
                Open in module workspace
              </Link>
              {domain === "sales" && (
                <>
                  <Link href="/dashboard/sales/contract-lines" className="block text-primary hover:underline">
                    Sales contract lines
                  </Link>
                  <Link href="/dashboard/sales/rebates" className="block text-primary hover:underline">
                    Rebates
                  </Link>
                </>
              )}
              {domain === "billing" && (
                <Link href="/dashboard/billing/invoices" className="block text-primary hover:underline">
                  Billing invoices
                </Link>
              )}
              {domain === "procurement" && (
                <Link href="/dashboard/procurement" className="block text-primary hover:underline">
                  Procurement hub
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
