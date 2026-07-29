"use client";

import { useEffect, useState } from "react";
import { Shield, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  listClearanceMatrix,
  assignClearance,
  listPersonsByLifecycle,
  CLEARANCE_LEVELS,
} from "@/lib/digital-identity";
import { toast } from "sonner";

export default function ClearancePage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [matrix, setMatrix] = useState<Array<Record<string, unknown>>>([]);
  const [persons, setPersons] = useState<Array<Record<string, unknown>>>([]);
  const [personId, setPersonId] = useState("");
  const [level, setLevel] = useState("employee");
  const [filterLevel, setFilterLevel] = useState("all");

  const load = async () => {
    if (!auth) return;
    try {
      const [m, p] = await Promise.all([
        listClearanceMatrix(auth.profile.company_id),
        listPersonsByLifecycle({ limit: 300 }),
      ]);
      setMatrix(m as Array<Record<string, unknown>>);
      setPersons(p as Array<Record<string, unknown>>);
    } catch {
      /* pending */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [auth]);

  const assign = async () => {
    if (!auth || !personId) {
      toast.error("Select a person");
      return;
    }
    try {
      await assignClearance({
        company_id: auth.profile.company_id,
        person_id: personId,
        clearance_level: level,
        reason: "Manual clearance assignment",
        granted_by: auth.user.id,
      });
      toast.success(`Clearance set to ${level}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assign failed");
    }
  };

  if (loading) return <LoadingState message="Loading security clearance…" />;

  const modules = Array.from(new Set(matrix.map((r) => String(r.module_code)))).sort();
  const filteredMatrix =
    filterLevel === "all"
      ? matrix
      : matrix.filter((r) => r.clearance_level === filterLevel);

  return (
    <div>
      <PageHeader
        title="Security Clearance"
        description="Visitor → Employee → Manager → Finance → HR → Executive → System Owner"
      />

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Assign clearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Person</p>
              <Select value={personId} onValueChange={setPersonId}>
                <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                <SelectContent>
                  {persons.map((p) => (
                    <SelectItem key={p.id as string} value={p.id as string}>
                      {String(p.display_name)} · {String(p.upid)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Level</p>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLEARANCE_LEVELS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={assign}>Assign</Button>
            <div className="flex flex-wrap gap-1 pt-2">
              {CLEARANCE_LEVELS.map((c) => (
                <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" /> Module access matrix
            </CardTitle>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {CLEARANCE_LEVELS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>View</TableHead>
                  <TableHead>Create</TableHead>
                  <TableHead>Approve</TableHead>
                  <TableHead>Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatrix.slice(0, 80).map((r) => (
                  <TableRow key={r.id as string}>
                    <TableCell className="text-xs font-medium">{String(r.clearance_level)}</TableCell>
                    <TableCell className="text-xs">{String(r.module_code)}</TableCell>
                    <TableCell>{r.can_view ? "✓" : "—"}</TableCell>
                    <TableCell>{r.can_create ? "✓" : "—"}</TableCell>
                    <TableCell>{r.can_approve ? "✓" : "—"}</TableCell>
                    <TableCell>{r.can_admin ? "✓" : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-[11px] text-muted-foreground mt-2">
              Example: Finance Officer can view AP & payroll but cannot modify salaries (payroll create/approve off).
              Modules covered: {modules.join(", ")}.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Current person clearances</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>UPID</TableHead>
                <TableHead>Clearance</TableHead>
                <TableHead>Department</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {persons.slice(0, 50).map((p) => (
                <TableRow key={p.id as string}>
                  <TableCell className="font-medium text-sm">{String(p.display_name)}</TableCell>
                  <TableCell className="font-mono text-xs">{String(p.upid)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{String(p.clearance_level || p.security_clearance || "employee")}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{String(p.department || "—")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
