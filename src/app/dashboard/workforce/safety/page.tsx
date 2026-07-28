"use client";

import { useEffect, useState } from "react";
import { HardHat, Plus, AlertTriangle } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

export default function SafetyPage() {
  const { auth } = useUser();
  const [ppe, setPpe] = useState<Array<Record<string, unknown>>>([]);
  const [incidents, setIncidents] = useState<Array<Record<string, unknown>>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [ppeOpen, setPpeOpen] = useState(false);
  const [incOpen, setIncOpen] = useState(false);
  const [ppeForm, setPpeForm] = useState({
    employee_id: "",
    item_name: "Safety boots",
    quantity: "1",
  });
  const [incForm, setIncForm] = useState({
    title: "",
    severity: "medium",
    location: "Main Factory",
    description: "",
    employee_id: "",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: p }, { data: i }, { data: e }] = await Promise.all([
      supabase
        .from("ppe_issuances")
        .select("*, employees(first_name,last_name)")
        .order("issued_on", { ascending: false })
        .limit(50),
      supabase
        .from("safety_incidents")
        .select("*")
        .order("incident_date", { ascending: false })
        .limit(50),
      supabase.from("employees").select("id,first_name,last_name").eq("status", "active"),
    ]);
    setPpe(p ?? []);
    setIncidents(i ?? []);
    setEmployees(e ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const issuePpe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const { error } = await supabase.from("ppe_issuances").insert({
      company_id: auth.profile.company_id,
      employee_id: ppeForm.employee_id,
      item_name: ppeForm.item_name,
      quantity: parseInt(ppeForm.quantity, 10) || 1,
      issued_on: new Date().toISOString().slice(0, 10),
      status: "issued",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("PPE issued");
      setPpeOpen(false);
      load();
    }
  };

  const reportIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const { error } = await supabase.from("safety_incidents").insert({
      company_id: auth.profile.company_id,
      title: incForm.title,
      severity: incForm.severity,
      location: incForm.location,
      description: incForm.description,
      employee_id: incForm.employee_id || null,
      status: "open",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Incident logged");
      setIncOpen(false);
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Safety & Compliance"
        description="PPE, inductions, OHS incidents — Uganda labour & occupational safety alignment"
        actions={
          <div className="flex gap-2">
            <Dialog open={ppeOpen} onOpenChange={setPpeOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Issue PPE
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={issuePpe}>
                  <DialogHeader>
                    <DialogTitle>Issue PPE</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-4">
                    <div className="space-y-2">
                      <Label>Employee</Label>
                      <Select
                        value={ppeForm.employee_id}
                        onValueChange={(v) =>
                          setPpeForm({ ...ppeForm, employee_id: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.first_name} {e.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Item</Label>
                      <Input
                        value={ppeForm.item_name}
                        onChange={(e) =>
                          setPpeForm({ ...ppeForm, item_name: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={!ppeForm.employee_id}>
                      Issue
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={incOpen} onOpenChange={setIncOpen}>
              <DialogTrigger asChild>
                <Button>
                  <AlertTriangle className="mr-2 h-4 w-4" /> Log incident
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={reportIncident}>
                  <DialogHeader>
                    <DialogTitle>Safety incident</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        required
                        value={incForm.title}
                        onChange={(e) =>
                          setIncForm({ ...incForm, title: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Severity</Label>
                        <Select
                          value={incForm.severity}
                          onValueChange={(v) =>
                            setIncForm({ ...incForm, severity: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["low", "medium", "high", "critical"].map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Location</Label>
                        <Input
                          value={incForm.location}
                          onChange={(e) =>
                            setIncForm({ ...incForm, location: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={incForm.description}
                        onChange={(e) =>
                          setIncForm({ ...incForm, description: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save incident</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Tabs defaultValue="incidents">
        <TabsList>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="ppe">PPE issuance</TabsTrigger>
        </TabsList>
        <TabsContent value="incidents" className="mt-4">
          {incidents.length === 0 ? (
            <EmptyState icon={HardHat} title="No incidents recorded" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((i) => (
                    <TableRow key={String(i.id)}>
                      <TableCell className="text-xs">
                        {formatDateTime(String(i.incident_date))}
                      </TableCell>
                      <TableCell className="font-medium">{String(i.title)}</TableCell>
                      <TableCell>{String(i.location || "—")}</TableCell>
                      <TableCell>
                        <StatusBadge status={String(i.severity)} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={String(i.status)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="ppe" className="mt-4">
          {ppe.length === 0 ? (
            <EmptyState title="No PPE issued yet" />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ppe.map((p) => {
                    const emp = p.employees as {
                      first_name: string;
                      last_name: string;
                    } | null;
                    return (
                      <TableRow key={String(p.id)}>
                        <TableCell>
                          {emp ? `${emp.first_name} ${emp.last_name}` : "—"}
                        </TableCell>
                        <TableCell>{String(p.item_name)}</TableCell>
                        <TableCell>{String(p.quantity)}</TableCell>
                        <TableCell>{formatDate(String(p.issued_on))}</TableCell>
                        <TableCell className="capitalize">
                          {String(p.status)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
