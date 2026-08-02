"use client";

import { useEffect, useState } from "react";
import { Headphones, Plus } from "lucide-react";
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
import { LoadingState } from "@/components/ui/loading-state";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate } from "@/lib/api/crud-client";

export default function TeamsPage() {
  const { auth } = useUser();
  const [teams, setTeams] = useState<Array<Record<string, unknown>>>([]);
  const [agents, setAgents] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<Array<{ id: string; first_name: string; last_name: string; email: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [form, setForm] = useState({ team_code: "", name: "", service_types: "it", categories: "" });
  const [agentForm, setAgentForm] = useState({ user_id: "", team_id: "", skills: "", max_open_tickets: "20" });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data: t }, { data: a }, { data: u }] = await Promise.all([
      supabase.from("sd_teams").select("*").order("team_code"),
      supabase.from("sd_agents").select("*, user_profiles(first_name,last_name,email), sd_teams(name)").order("created_at", { ascending: false }),
      supabase.from("user_profiles").select("id,first_name,last_name,email").eq("is_active", true).limit(100),
    ]);
    setTeams((t as Array<Record<string, unknown>>) || []);
    setAgents((a as Array<Record<string, unknown>>) || []);
    setUsers((u as typeof users) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const crudRes2 = await crudCreate("sd_teams", {
      company_id: companyId,
      team_code: form.team_code,
      name: form.name,
      service_types: form.service_types.split(",").map((s) => s.trim()).filter(Boolean),
      categories: form.categories.split(",").map((s) => s.trim()).filter(Boolean),
      is_active: true,
    });
    if (!crudRes2.ok) toast.error(crudRes2.error);
    else {
      toast.success("Team created");
      setOpen(false);
      await load();
    }
  };

  const createAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const user = users.find((u) => u.id === agentForm.user_id);
    const crudRes = await crudCreate("sd_agents", {
      company_id: companyId,
      user_id: agentForm.user_id,
      team_id: agentForm.team_id || null,
      display_name: user ? `${user.first_name} ${user.last_name}` : null,
      skills: agentForm.skills.split(",").map((s) => s.trim()).filter(Boolean),
      max_open_tickets: Number(agentForm.max_open_tickets) || 20,
      is_available: true,
      is_active: true,
    });
    if (!crudRes.ok) toast.error(crudRes.error);
    else {
      toast.success("Agent registered");
      setAgentOpen(false);
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading teams…" />;

  return (
    <div>
      <PageHeader
        title="Teams & Agents"
        description="Routing pools · skills · capacity · availability"
        actions={
          <div className="flex gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Team</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createTeam}>
                  <DialogHeader><DialogTitle>New team</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Code</Label>
                        <Input required value={form.team_code} onChange={(e) => setForm((f) => ({ ...f, team_code: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Name</Label>
                        <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Service types (comma)</Label>
                      <Input value={form.service_types} onChange={(e) => setForm((f) => ({ ...f, service_types: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Categories (comma)</Label>
                      <Input value={form.categories} onChange={(e) => setForm((f) => ({ ...f, categories: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Create</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={agentOpen} onOpenChange={setAgentOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Agent</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createAgent}>
                  <DialogHeader><DialogTitle>Register agent</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>User</Label>
                      <Select value={agentForm.user_id} onValueChange={(v) => setAgentForm((f) => ({ ...f, user_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Team</Label>
                      <Select value={agentForm.team_id || "none"} onValueChange={(v) => setAgentForm((f) => ({ ...f, team_id: v === "none" ? "" : v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {teams.map((t) => (
                            <SelectItem key={String(t.id)} value={String(t.id)}>{String(t.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Skills (comma)</Label>
                      <Input value={agentForm.skills} onChange={(e) => setAgentForm((f) => ({ ...f, skills: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Max open tickets</Label>
                      <Input type="number" value={agentForm.max_open_tickets} onChange={(e) => setAgentForm((f) => ({ ...f, max_open_tickets: e.target.value }))} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit">Register</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard title="Teams" value={String(teams.length)} icon={Headphones} />
        <StatCard title="Agents" value={String(agents.length)} icon={Headphones} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Services</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((t) => (
                <TableRow key={String(t.id)}>
                  <TableCell className="font-mono text-sm">{String(t.team_code)}</TableCell>
                  <TableCell>{String(t.name)}</TableCell>
                  <TableCell className="space-x-1">
                    {((t.service_types as string[]) || []).map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>Available</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((a) => {
                const u = a.user_profiles as { first_name?: string; last_name?: string } | null;
                const t = a.sd_teams as { name?: string } | null;
                return (
                  <TableRow key={String(a.id)}>
                    <TableCell className="text-sm">
                      {String(a.display_name || `${u?.first_name || ""} ${u?.last_name || ""}`)}
                    </TableCell>
                    <TableCell className="text-sm">{String(t?.name || "—")}</TableCell>
                    <TableCell className="text-xs">
                      {((a.skills as string[]) || []).join(", ") || "—"}
                    </TableCell>
                    <TableCell>{a.is_available ? "Yes" : "No"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
