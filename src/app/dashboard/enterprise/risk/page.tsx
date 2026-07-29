"use client";

import { useEffect, useState } from "react";
import { Plus, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  listRisks, createRisk, listInsurance, createInsurance,
  RISK_CATEGORIES, INSURANCE_TYPES,
} from "@/lib/enterprise-company";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function RiskInsurancePage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [risks, setRisks] = useState<Array<Record<string, unknown>>>([]);
  const [policies, setPolicies] = useState<Array<Record<string, unknown>>>([]);
  const [dialog, setDialog] = useState<"risk" | "insurance" | null>(null);
  const [riskForm, setRiskForm] = useState({
    risk_code: "", title: "", category: "operational", risk_owner: "",
  });
  const [insForm, setInsForm] = useState({
    policy_type: "property", policy_number: "", insurer_name: "", end_date: "",
  });

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    const cid = auth.profile.company_id;
    try {
      const [r, i] = await Promise.all([listRisks(cid), listInsurance(cid)]);
      setRisks(r as Array<Record<string, unknown>>);
      setPolicies(i as Array<Record<string, unknown>>);
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [auth]);

  const save = async () => {
    if (!auth) return;
    try {
      if (dialog === "risk") {
        if (!riskForm.risk_code || !riskForm.title) return toast.error("Code and title required");
        await createRisk({
          company_id: auth.profile.company_id,
          risk_code: riskForm.risk_code,
          title: riskForm.title,
          category: riskForm.category,
          risk_owner: riskForm.risk_owner || undefined,
        });
      } else {
        await createInsurance({
          company_id: auth.profile.company_id,
          policy_type: insForm.policy_type,
          policy_number: insForm.policy_number || undefined,
          insurer_name: insForm.insurer_name || undefined,
          end_date: insForm.end_date || undefined,
        });
      }
      toast.success("Saved");
      setDialog(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading risk & insurance…" />;

  const levelColor = (l: string) =>
    l === "critical" || l === "high" ? "destructive" : l === "medium" ? "secondary" : "outline";

  return (
    <div>
      <PageHeader
        title="Risk & Insurance"
        description="Risk register · mitigation · policies · renewal alerts"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDialog("risk")}>
              <Plus className="h-4 w-4 mr-1" /> Risk
            </Button>
            <Button size="sm" onClick={() => setDialog("insurance")}>
              <Plus className="h-4 w-4 mr-1" /> Policy
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Risk register
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Impact</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {risks.map((r) => (
                  <TableRow key={r.id as string}>
                    <TableCell className="font-mono text-xs">{String(r.risk_code)}</TableCell>
                    <TableCell className="text-sm">{String(r.title)}</TableCell>
                    <TableCell>
                      <Badge variant={levelColor(String(r.impact || r.residual_rating)) as "outline"}>
                        {String(r.impact || r.residual_rating)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{String(r.risk_owner || "—")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Insurance policies</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Insurer</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((p) => (
                  <TableRow key={p.id as string}>
                    <TableCell><Badge variant="outline">{String(p.policy_type)}</Badge></TableCell>
                    <TableCell className="text-sm">{String(p.insurer_name || "—")}</TableCell>
                    <TableCell className="text-xs">{p.end_date ? formatDate(String(p.end_date)) : "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{String(p.status)}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "risk" ? "New risk" : "New insurance policy"}</DialogTitle>
          </DialogHeader>
          {dialog === "risk" ? (
            <div className="space-y-3">
              <div><Label>Code</Label><Input value={riskForm.risk_code} onChange={(e) => setRiskForm({ ...riskForm, risk_code: e.target.value })} /></div>
              <div><Label>Title</Label><Input value={riskForm.title} onChange={(e) => setRiskForm({ ...riskForm, title: e.target.value })} /></div>
              <div>
                <Label>Category</Label>
                <Select value={riskForm.category} onValueChange={(v) => setRiskForm({ ...riskForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RISK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Owner</Label><Input value={riskForm.risk_owner} onChange={(e) => setRiskForm({ ...riskForm, risk_owner: e.target.value })} /></div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Type</Label>
                <Select value={insForm.policy_type} onValueChange={(v) => setInsForm({ ...insForm, policy_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INSURANCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Policy #</Label><Input value={insForm.policy_number} onChange={(e) => setInsForm({ ...insForm, policy_number: e.target.value })} /></div>
              <div><Label>Insurer</Label><Input value={insForm.insurer_name} onChange={(e) => setInsForm({ ...insForm, insurer_name: e.target.value })} /></div>
              <div><Label>End date</Label><Input type="date" value={insForm.end_date} onChange={(e) => setInsForm({ ...insForm, end_date: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
