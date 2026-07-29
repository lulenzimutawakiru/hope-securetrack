"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

export default function TrainingPage() {
  const { auth } = useUser();
  const [courses, setCourses] = useState<Array<Record<string, unknown>>>([]);
  const [enrollments, setEnrollments] = useState<Array<Record<string, unknown>>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; first_name: string; last_name: string; employee_number: string }>>([]);
  const [courseId, setCourseId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const [{ data: c }, { data: en }, { data: e }] = await Promise.all([
      supabase.from("training_courses").select("*").eq("is_active", true).order("title"),
      supabase
        .from("training_enrollments")
        .select("*, training_courses(title, course_code), employees(first_name,last_name,employee_number)")
        .order("enrolled_at", { ascending: false })
        .limit(100),
      supabase
        .from("employees")
        .select("id,first_name,last_name,employee_number")
        .eq("status", "active")
        .order("last_name"),
    ]);
    setCourses(c ?? []);
    setEnrollments(en ?? []);
    setEmployees(e ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const enroll = async () => {
    if (!auth || !courseId || !employeeId) {
      toast.error("Select course and employee");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("training_enrollments").insert({
      company_id: auth.profile.company_id,
      course_id: courseId,
      employee_id: employeeId,
      status: "enrolled",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Enrolled");
      load();
    }
  };

  const complete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("training_enrollments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        score: 85,
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Marked completed");
      load();
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Training & Learning"
        description="Courses · mandatory compliance · enrollments · certificates"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/hr">Hub</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6 items-end">
        <div className="w-56">
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger>
              <SelectValue placeholder="Course" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={String(c.id)} value={String(c.id)}>
                  {String(c.course_code)} — {String(c.title)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-56">
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.employee_number} — {e.first_name} {e.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={enroll}>
          <Plus className="h-4 w-4 mr-1" />
          Enroll
        </Button>
      </div>

      <h3 className="font-medium mb-2">Course catalog</h3>
      {courses.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No courses" description="Add training courses" />
      ) : (
        <div className="rounded-lg border overflow-x-auto mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Mandatory</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((c) => (
                <TableRow key={String(c.id)}>
                  <TableCell className="font-mono text-sm">
                    {String(c.course_code)}
                  </TableCell>
                  <TableCell className="font-medium">{String(c.title)}</TableCell>
                  <TableCell>{String(c.category ?? "—")}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(c.duration_hours))}
                  </TableCell>
                  <TableCell>
                    {c.is_mandatory ? (
                      <Badge className="bg-amber-100 text-amber-800">Yes</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(Number(c.cost || 0))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="font-medium mb-2">Enrollments</h3>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Enrolled</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrollments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-muted-foreground">
                  No enrollments
                </TableCell>
              </TableRow>
            ) : (
              enrollments.map((en) => {
                const emp = en.employees as {
                  first_name?: string;
                  last_name?: string;
                  employee_number?: string;
                } | null;
                const course = en.training_courses as {
                  title?: string;
                  course_code?: string;
                } | null;
                return (
                  <TableRow key={String(en.id)}>
                    <TableCell>
                      {emp?.employee_number} {emp?.first_name} {emp?.last_name}
                    </TableCell>
                    <TableCell>
                      {course?.course_code} — {course?.title}
                    </TableCell>
                    <TableCell>
                      {en.enrolled_at
                        ? formatDate(String(en.enrolled_at).slice(0, 10))
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={String(en.status)} />
                    </TableCell>
                    <TableCell>
                      {en.status !== "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => complete(String(en.id))}
                        >
                          Complete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
