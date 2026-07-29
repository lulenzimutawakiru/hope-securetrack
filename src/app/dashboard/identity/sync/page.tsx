"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ArrowRightLeft } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import {
  listSyncRules,
  listSyncLog,
  listPersonsByLifecycle,
  syncDepartmentChange,
  updateMasterProfile,
} from "@/lib/digital-identity";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function HrSyncPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [log, setLog] = useState<Array<Record<string, unknown>>>([]);
  const [persons, setPersons] = useState<Array<Record<string, unknown>>>([]);
  const [personId, setPersonId] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  const load = async () => {
    if (!auth) return;
    try {
      const [r, l, p] = await Promise.all([
        listSyncRules(auth.profile.company_id),
        listSyncLog({ limit: 50 }),
        listPersonsByLifecycle({ limit: 200 }),
      ]);
      setRules(r as Array<Record<string, unknown>>);
      setLog(l as Array<Record<string, unknown>>);
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

  const apply = async () => {
    if (!auth || !personId) {
      toast.error("Select a person");
      return;
    }
    try {
      if (department) {
        await syncDepartmentChange({
          person_id: personId,
          company_id: auth.profile.company_id,
          department,
          actor_id: auth.user.id,
        });
      }
      if (jobTitle) {
        await updateMasterProfile(
          personId,
          auth.profile.company_id,
          { job_title: jobTitle, position_title: jobTitle },
          auth.user.id
        );
      }
      toast.success("HR change synchronized across modules");
      setDepartment("");
      setJobTitle("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    }
  };

  if (loading) return <LoadingState message="Loading HR ↔ user sync…" />;

  return (
    <div>
      <PageHeader
        title="HR ↔ Module Synchronization"
        description="Department · title · manager · cost centre · email · status · clearance propagate automatically"
      />

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" /> Apply HR change
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger><SelectValue placeholder="Person" /></SelectTrigger>
              <SelectContent>
                {persons.map((p) => (
                  <SelectItem key={p.id as string} value={p.id as string}>
                    {String(p.display_name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="New department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <Input
              placeholder="New job title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
            <Button className="w-full" onClick={apply}>
              <RefreshCw className="h-4 w-4 mr-1" /> Sync now
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Updates user profile, payroll cost centre targets, directory, HopeChat, attendance structure, and approval chains.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sync rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Targets</TableHead>
                    <TableHead>Auto</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id as string}>
                      <TableCell className="font-mono text-xs">{String(r.field_key)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {((r.target_modules as string[]) || []).map((m) => (
                            <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{r.auto_sync ? "✓" : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[240px]">
                        {String(r.description || "")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sync audit log</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Old → New</TableHead>
                <TableHead>Targets</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-sm">
                    No sync events yet
                  </TableCell>
                </TableRow>
              ) : (
                log.map((row) => {
                  const person = row.uw_persons as Record<string, unknown> | null;
                  return (
                    <TableRow key={row.id as string}>
                      <TableCell className="text-xs">{formatDate(String(row.created_at))}</TableCell>
                      <TableCell className="text-sm">
                        {person ? String(person.display_name) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{String(row.field_key)}</TableCell>
                      <TableCell className="text-xs">
                        <span className="text-muted-foreground">{String(row.old_value || "∅")}</span>
                        {" → "}
                        <span className="font-medium">{String(row.new_value || "∅")}</span>
                      </TableCell>
                      <TableCell className="text-[10px]">
                        {((row.targets_updated as string[]) || []).join(", ")}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
