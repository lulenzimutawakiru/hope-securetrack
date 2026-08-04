"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

export default function SkillsPage() {
  const { auth } = useUser();
  const [catalog, setCatalog] = useState<Array<Record<string, unknown>>>([]);
  const [matrix, setMatrix] = useState<Array<Record<string, unknown>>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    skill_id: "",
    proficiency: "3",
    certified: "false",
  });

  const load = async () => {
    const supabase = createClient();
    const [{ data: c }, { data: m }, { data: e }] = await Promise.all([
      supabase.from("skill_catalog").select("*").eq("is_active", true).order("name"),
      supabase
        .from("employee_skills")
        .select("*, employees(first_name,last_name), skill_catalog(name,code,category)")
        .order("created_at", { ascending: false }),
      supabase.from("employees").select("id,first_name,last_name").eq("status", "active"),
    ]);
    setCatalog(c ?? []);
    setMatrix(m ?? []);
    setEmployees(e ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const assign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    const supabase = createClient();
    const crudRes = await crudCreate("employee_skills", {
      company_id: auth.profile.company_id,
      employee_id: form.employee_id,
      skill_id: form.skill_id,
      proficiency: parseInt(form.proficiency, 10),
      certified: form.certified === "true",
    });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Skill assigned");
      setOpen(false);
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Skills & Training"
        description="Skills matrix, certifications, competency for security printing and engineering"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Assign skill
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={assign}>
                <DialogHeader>
                  <DialogTitle>Assign skill</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select
                      value={form.employee_id}
                      onValueChange={(v) => setForm({ ...form, employee_id: v })}
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
                    <Label>Skill</Label>
                    <Select
                      value={form.skill_id}
                      onValueChange={(v) => setForm({ ...form, skill_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select skill" />
                      </SelectTrigger>
                      <SelectContent>
                        {catalog.map((s) => (
                          <SelectItem key={String(s.id)} value={String(s.id)}>
                            {String(s.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Proficiency (1–5)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={form.proficiency}
                        onChange={(e) =>
                          setForm({ ...form, proficiency: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Certified</Label>
                      <Select
                        value={form.certified}
                        onValueChange={(v) => setForm({ ...form, certified: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {catalog.map((s) => (
          <Badge key={String(s.id)} variant="outline" className="py-1.5 px-3">
            {String(s.code)} · {String(s.name)}
            {s.category ? ` · ${String(s.category)}` : ""}
          </Badge>
        ))}
      </div>

      {matrix.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No skill assignments yet" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Skill</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Certified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.map((r) => {
                const emp = r.employees as { first_name: string; last_name: string } | null;
                const sk = r.skill_catalog as {
                  name: string;
                  code: string;
                  category: string;
                } | null;
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell>
                      {emp ? `${emp.first_name} ${emp.last_name}` : "—"}
                    </TableCell>
                    <TableCell>
                      {sk?.name}{" "}
                      <span className="text-xs text-muted-foreground font-mono">
                        {sk?.code}
                      </span>
                    </TableCell>
                    <TableCell>{sk?.category ?? "—"}</TableCell>
                    <TableCell>{String(r.proficiency)}/5</TableCell>
                    <TableCell>{r.certified ? "Yes" : "No"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
