"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, Plus } from "lucide-react";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";

const STAGES = [
  "applied",
  "shortlisted",
  "interview",
  "assessment",
  "offer",
  "accepted",
  "hired",
  "rejected",
] as const;

export default function RecruitmentPage() {
  const { auth } = useUser();
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [apps, setApps] = useState<Array<Record<string, unknown>>>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobOpen, setJobOpen] = useState(false);
  const [appOpen, setAppOpen] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: "",
    department: "Production",
    positions: "1",
  });
  const [appForm, setAppForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("job_requisitions")
      .select("*")
      .order("created_at", { ascending: false });
    setJobs(data ?? []);
    setLoading(false);
  };

  const loadApps = async (jobId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("job_applicants")
      .select("*")
      .eq("requisition_id", jobId)
      .order("created_at", { ascending: false });
    setApps(data ?? []);
    setSelectedJob(jobId);
  };

  useEffect(() => {
    load();
  }, []);

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const num = `JR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { error } = await supabase.from("job_requisitions").insert({
      company_id: auth.profile.company_id,
      requisition_number: num,
      title: jobForm.title,
      department: jobForm.department,
      positions: Number(jobForm.positions),
      status: "open",
      requested_by: auth.profile.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Opened ${num}`);
      setJobOpen(false);
      load();
    }
  };

  const createApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !selectedJob) return;
    const supabase = createClient();
    const num = `APP-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const { error } = await supabase.from("job_applicants").insert({
      company_id: auth.profile.company_id,
      requisition_id: selectedJob,
      applicant_number: num,
      first_name: appForm.first_name,
      last_name: appForm.last_name,
      email: appForm.email || null,
      phone: appForm.phone || null,
      stage: "applied",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Applicant added");
      setAppOpen(false);
      loadApps(selectedJob);
    }
  };

  const setStage = async (id: string, stage: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("job_applicants")
      .update({ stage })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Stage → ${stage}`);
      if (selectedJob) loadApps(selectedJob);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Recruitment"
        description="Job requisitions · applicant tracking · interview → offer → hire"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/hr">Hub</Link>
            </Button>
            <Dialog open={jobOpen} onOpenChange={setJobOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New vacancy
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createJob} className="space-y-3">
                  <DialogHeader>
                    <DialogTitle>Job requisition</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input
                      value={jobForm.title}
                      onChange={(e) => setJobForm((f) => ({ ...f, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Department</Label>
                      <Input
                        value={jobForm.department}
                        onChange={(e) =>
                          setJobForm((f) => ({ ...f, department: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Positions</Label>
                      <Input
                        type="number"
                        min="1"
                        value={jobForm.positions}
                        onChange={(e) =>
                          setJobForm((f) => ({ ...f, positions: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Open vacancy</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          {jobs.length === 0 ? (
            <EmptyState icon={UserPlus} title="No vacancies" description="Create a job requisition" />
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Req #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Dept</TableHead>
                    <TableHead className="text-right">#</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow
                      key={String(j.id)}
                      className="cursor-pointer"
                      onClick={() => loadApps(String(j.id))}
                    >
                      <TableCell className="font-mono text-sm">
                        {String(j.requisition_number)}
                      </TableCell>
                      <TableCell className="font-medium">{String(j.title)}</TableCell>
                      <TableCell>{String(j.department ?? "—")}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(Number(j.positions))}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={String(j.status)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">
              {selectedJob ? "Applicant pipeline" : "Select a vacancy"}
            </h3>
            {selectedJob && (
              <Dialog open={appOpen} onOpenChange={setAppOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    Add applicant
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={createApp} className="space-y-3">
                    <DialogHeader>
                      <DialogTitle>New applicant</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>First name</Label>
                        <Input
                          value={appForm.first_name}
                          onChange={(e) =>
                            setAppForm((f) => ({ ...f, first_name: e.target.value }))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Last name</Label>
                        <Input
                          value={appForm.last_name}
                          onChange={(e) =>
                            setAppForm((f) => ({ ...f, last_name: e.target.value }))
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={appForm.email}
                        onChange={(e) =>
                          setAppForm((f) => ({ ...f, email: e.target.value }))
                        }
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit">Save</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
          {!selectedJob ? (
            <p className="text-sm text-muted-foreground">
              Click a requisition to manage applicants.
            </p>
          ) : apps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applicants yet</p>
          ) : (
            <div className="space-y-2">
              {apps.map((a) => (
                <div key={String(a.id)} className="rounded border p-3 space-y-2">
                  <div className="flex justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {String(a.first_name)} {String(a.last_name)}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {String(a.applicant_number)} · {String(a.email ?? "")}
                      </div>
                    </div>
                    <StatusBadge status={String(a.stage)} />
                  </div>
                  <Select
                    value={String(a.stage)}
                    onValueChange={(v) => setStage(String(a.id), v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
