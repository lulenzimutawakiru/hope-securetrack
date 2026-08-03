"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { useUser } from "@/hooks/use-user";
import { getDirectory } from "@/lib/enterprise-company";

export default function DirectoryPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<{
    employees: Array<Record<string, unknown>>;
    branches: Array<Record<string, unknown>>;
    departments: Array<Record<string, unknown>>;
    board: Array<Record<string, unknown>>;
  }>({ employees: [], branches: [], departments: [], board: [] });

  useEffect(() => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    getDirectory(auth.profile.company_id)
      .then((d) => setData(d as typeof data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [auth]);

  if (loading) return <LoadingState message="Loading company directory…" />;

  const q = search.trim().toLowerCase();
  const employees = data.employees.filter((e) => {
    if (!q) return true;
    const hay = `${e.first_name} ${e.last_name} ${e.email} ${e.department} ${e.job_title}`.toLowerCase();
    return hay.includes(q);
  });

  return (
    <div>
      <PageHeader
        title="Company Directory"
        description="Employees · branches · departments · board · integrated with SecureChat & Service Desk"
      />
      <Input
        className="max-w-md mb-6"
        placeholder="Search people…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Branches</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{data.branches.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Departments</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{data.departments.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">People</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{data.employees.length}</CardContent>
        </Card>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((e) => (
              <TableRow key={e.id as string}>
                <TableCell className="font-medium text-sm">
                  {String(e.first_name)} {String(e.last_name)}
                </TableCell>
                <TableCell className="text-xs">{String(e.job_title || "—")}</TableCell>
                <TableCell className="text-xs">{String(e.department || "—")}</TableCell>
                <TableCell className="text-xs">{String(e.email || "—")}</TableCell>
                <TableCell className="text-xs">{String(e.phone || "—")}</TableCell>
                <TableCell><Badge variant="outline">{String(e.status || "active")}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
