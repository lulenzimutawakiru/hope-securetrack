"use client";

import { useEffect, useState } from "react";
import { Plus, Target } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function PipelinePage() {
  const { auth } = useUser();
  const [leads, setLeads] = useState<Array<Record<string, unknown>>>([]);
  const [opps, setOpps] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [leadOpen, setLeadOpen] = useState(false);
  const [oppOpen, setOppOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({
    company_name: "",
    contact_name: "",
    phone: "",
    email: "",
    source: "referral",
    estimated_value: "1000000",
  });
  const [oppForm, setOppForm] = useState({
    name: "",
    expected_value: "5000000",
    probability: "40",
    stage: "prospecting",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: l }, { data: o }] = await Promise.all([
      supabase.from("sales_leads").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("sales_opportunities").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setLeads(l ?? []);
    setOpps(o ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const num = `LD-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from("sales_leads").insert({
      company_id: auth.profile.company_id,
      lead_number: num,
      company_name: leadForm.company_name,
      contact_name: leadForm.contact_name || null,
      phone: leadForm.phone || null,
      email: leadForm.email || null,
      source: leadForm.source,
      estimated_value: parseFloat(leadForm.estimated_value) || 0,
      currency: "UGX",
      status: "new",
      assigned_to: auth.profile.id,
      created_by: auth.profile.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Lead ${num} created`);
      setLeadOpen(false);
      load();
    }
  };

  const createOpp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const num = `OPP-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from("sales_opportunities").insert({
      company_id: auth.profile.company_id,
      opportunity_number: num,
      name: oppForm.name,
      stage: oppForm.stage,
      probability: parseInt(oppForm.probability, 10),
      expected_value: parseFloat(oppForm.expected_value) || 0,
      currency: "UGX",
      owner_id: auth.profile.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Opportunity ${num} created`);
      setOppOpen(false);
      load();
    }
  };

  const setLeadStatus = async (id: string, status: string) => {
    const supabase = createClient();
    await supabase.from("sales_leads").update({ status }).eq("id", id);
    load();
  };

  const setOppStage = async (id: string, stage: string) => {
    const supabase = createClient();
    const probability =
      stage === "won" ? 100 : stage === "lost" ? 0 : stage === "negotiation" ? 70 : stage === "proposal" ? 50 : 30;
    await supabase.from("sales_opportunities").update({ stage, probability }).eq("id", id);
    load();
  };

  if (loading) return <LoadingState />;

  const pipelineValue = opps
    .filter((o) => !["won", "lost"].includes(String(o.stage)))
    .reduce((s, o) => s + Number(o.expected_value || 0), 0);

  return (
    <div>
      <PageHeader
        title="Sales Pipeline"
        description="Lead → Opportunity conversion for Hope Design B2B, government & export channels"
        actions={
          <div className="flex gap-2">
            <Dialog open={leadOpen} onOpenChange={setLeadOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Lead
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createLead}>
                  <DialogHeader>
                    <DialogTitle>New lead</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-4">
                    <Input
                      required
                      placeholder="Company name"
                      value={leadForm.company_name}
                      onChange={(e) =>
                        setLeadForm({ ...leadForm, company_name: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Contact"
                      value={leadForm.contact_name}
                      onChange={(e) =>
                        setLeadForm({ ...leadForm, contact_name: e.target.value })
                      }
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Phone"
                        value={leadForm.phone}
                        onChange={(e) =>
                          setLeadForm({ ...leadForm, phone: e.target.value })
                        }
                      />
                      <Input
                        placeholder="Est. value"
                        type="number"
                        value={leadForm.estimated_value}
                        onChange={(e) =>
                          setLeadForm({
                            ...leadForm,
                            estimated_value: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save lead</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={oppOpen} onOpenChange={setOppOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Opportunity
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createOpp}>
                  <DialogHeader>
                    <DialogTitle>New opportunity</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-4">
                    <Input
                      required
                      placeholder="Opportunity name"
                      value={oppForm.name}
                      onChange={(e) =>
                        setOppForm({ ...oppForm, name: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      placeholder="Expected value"
                      value={oppForm.expected_value}
                      onChange={(e) =>
                        setOppForm({ ...oppForm, expected_value: e.target.value })
                      }
                    />
                    <Select
                      value={oppForm.stage}
                      onValueChange={(v) => setOppForm({ ...oppForm, stage: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "prospecting",
                          "qualification",
                          "proposal",
                          "negotiation",
                        ].map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatCard title="Leads" value={formatNumber(leads.length)} icon={Target} />
        <StatCard title="Opportunities" value={formatNumber(opps.length)} />
        <StatCard
          title="Open pipeline"
          value={`UGX ${formatNumber(Math.round(pipelineValue))}`}
        />
      </div>

      <Tabs defaultValue="opps">
        <TabsList>
          <TabsTrigger value="opps">Opportunities</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
        </TabsList>
        <TabsContent value="opps" className="mt-4">
          {opps.length === 0 ? (
            <EmptyState title="No opportunities" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Prob.</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Move</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opps.map((o) => (
                    <TableRow key={String(o.id)}>
                      <TableCell className="font-mono text-xs">
                        {String(o.opportunity_number)}
                      </TableCell>
                      <TableCell className="font-medium">{String(o.name)}</TableCell>
                      <TableCell>
                        UGX {formatNumber(Number(o.expected_value || 0))}
                      </TableCell>
                      <TableCell>{String(o.probability)}%</TableCell>
                      <TableCell>
                        <StatusBadge status={String(o.stage)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={String(o.stage)}
                          onValueChange={(v) => setOppStage(String(o.id), v)}
                        >
                          <SelectTrigger className="w-[140px] ml-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "prospecting",
                              "qualification",
                              "proposal",
                              "negotiation",
                              "won",
                              "lost",
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
        </TabsContent>
        <TabsContent value="leads" className="mt-4">
          {leads.length === 0 ? (
            <EmptyState title="No leads" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((l) => (
                    <TableRow key={String(l.id)}>
                      <TableCell className="font-mono text-xs">
                        {String(l.lead_number)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {String(l.company_name)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {String(l.contact_name || "—")}
                      </TableCell>
                      <TableCell>
                        UGX {formatNumber(Number(l.estimated_value || 0))}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={String(l.status)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={String(l.status)}
                          onValueChange={(v) => setLeadStatus(String(l.id), v)}
                        >
                          <SelectTrigger className="w-[130px] ml-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              "new",
                              "contacted",
                              "qualified",
                              "unqualified",
                              "converted",
                              "lost",
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
