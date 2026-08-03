"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Plus, Star, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudDelete } from "@/lib/api/crud-client";

const DEFAULT_BUSINESS_HOURS = JSON.stringify(
  {
    mon: ["08:00", "17:00"],
    tue: ["08:00", "17:00"],
    wed: ["08:00", "17:00"],
    thu: ["08:00", "17:00"],
    fri: ["08:00", "17:00"],
    sat: [],
    sun: [],
  },
  null,
  2
);

export default function AdminPage() {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [calendars, setCalendars] = useState<Array<Record<string, unknown>>>([]);
  const [holidays, setHolidays] = useState<Array<Record<string, unknown>>>([]);
  const [calOpen, setCalOpen] = useState(false);
  const [holOpen, setHolOpen] = useState(false);
  const [calForm, setCalForm] = useState({
    name: "",
    calendar_code: "",
    timezone: "Africa/Kampala",
    business_hours: DEFAULT_BUSINESS_HOURS,
    is_default: false,
  });
  const [holForm, setHolForm] = useState({
    calendar_id: "",
    holiday_date: "",
    name: "",
    is_recurring: false,
  });

  const companyId = auth?.profile?.company_id as string | undefined;

  const load = async () => {
    const supabase = createClient();
    const [{ data: c }, { data: h }] = await Promise.all([
      supabase.from("sd_calendars").select("*").order("name"),
      supabase.from("sd_holidays").select("*").order("holiday_date"),
    ]);
    setCalendars((c as Array<Record<string, unknown>>) || []);
    setHolidays((h as Array<Record<string, unknown>>) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const createCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    let businessHours: Record<string, unknown> = {};
    try {
      businessHours = JSON.parse(calForm.business_hours) as Record<string, unknown>;
    } catch {
      toast.error("Business hours must be valid JSON");
      return;
    }
    const res = await crudCreate("sd_calendars", {
      company_id: companyId,
      name: calForm.name,
      calendar_code: calForm.calendar_code.trim().toUpperCase().replace(/\s+/g, "-"),
      timezone: calForm.timezone,
      business_hours: businessHours,
      is_default: calForm.is_default,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Calendar created");
      setCalOpen(false);
      setCalForm({ name: "", calendar_code: "", timezone: "Africa/Kampala", business_hours: DEFAULT_BUSINESS_HOURS, is_default: false });
      await load();
    }
  };

  const createHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const res = await crudCreate("sd_holidays", {
      company_id: companyId,
      calendar_id: holForm.calendar_id || null,
      holiday_date: holForm.holiday_date,
      name: holForm.name,
      is_recurring: holForm.is_recurring,
    });
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Holiday added");
      setHolOpen(false);
      setHolForm({ calendar_id: "", holiday_date: "", name: "", is_recurring: false });
      await load();
    }
  };

  const removeCalendar = async (id: string) => {
    const res = await crudDelete("sd_calendars", id);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Calendar removed");
      await load();
    }
  };

  const removeHoliday = async (id: string) => {
    const res = await crudDelete("sd_holidays", id);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Holiday removed");
      await load();
    }
  };

  if (loading) return <LoadingState message="Loading service desk administration..." />;

  return (
    <div>
      <PageHeader
        title="Service Desk Administration"
        description="Business calendars · working hours · holidays · SLA schedule"
        actions={
          <div className="flex flex-wrap gap-2">
            <Dialog open={calOpen} onOpenChange={setCalOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Calendar</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createCalendar}>
                  <DialogHeader><DialogTitle>New business calendar</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Name</Label>
                        <Input required value={calForm.name} onChange={(e) => setCalForm((f) => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Code</Label>
                        <Input required value={calForm.calendar_code} onChange={(e) => setCalForm((f) => ({ ...f, calendar_code: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <Label>Timezone</Label>
                      <Input value={calForm.timezone} onChange={(e) => setCalForm((f) => ({ ...f, timezone: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Business hours (JSON)</Label>
                      <Textarea
                        rows={8}
                        className="font-mono text-xs"
                        value={calForm.business_hours}
                        onChange={(e) => setCalForm((f) => ({ ...f, business_hours: e.target.value }))}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={calForm.is_default}
                        onChange={(e) => setCalForm((f) => ({ ...f, is_default: e.target.checked }))}
                      />
                      Default calendar
                    </label>
                  </div>
                  <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={holOpen} onOpenChange={setHolOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Holiday</Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={createHoliday}>
                  <DialogHeader><DialogTitle>Add public holiday</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-3">
                    <div>
                      <Label>Calendar</Label>
                      <Select
                        value={holForm.calendar_id}
                        onValueChange={(v) => setHolForm((f) => ({ ...f, calendar_id: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Select calendar" /></SelectTrigger>
                        <SelectContent>
                          {calendars.length === 0 && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">No calendars yet</div>
                          )}
                          {calendars.map((c) => (
                            <SelectItem key={String(c.id)} value={String(c.id)}>
                              {String(c.name)} ({String(c.calendar_code)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input required type="date" value={holForm.holiday_date} onChange={(e) => setHolForm((f) => ({ ...f, holiday_date: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input required value={holForm.name} onChange={(e) => setHolForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={holForm.is_recurring}
                        onChange={(e) => setHolForm((f) => ({ ...f, is_recurring: e.target.checked }))}
                      />
                      Repeats every year
                    </label>
                  </div>
                  <DialogFooter><Button type="submit">Save</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Calendars" value={String(calendars.length)} icon={CalendarDays} />
        <StatCard title="Holidays" value={String(holidays.length)} icon={Star} />
        <StatCard title="Default calendar" value={String((calendars.find((c) => c.is_default) as Record<string, unknown> | undefined)?.name ?? "None")} icon={Star} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Business calendars</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {calendars.length === 0 && (
              <EmptyState title="No calendars" description="Create a calendar to drive SLA business hours and holidays." />
            )}
            {calendars.map((c) => (
              <div key={String(c.id)} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{String(c.name)}</span>
                      {Boolean(c.is_default) && <Badge className="text-[10px]">Default</Badge>}
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {String(c.calendar_code)} · {String(c.timezone)}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeCalendar(String(c.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <pre className="text-[10px] bg-muted/50 p-2 rounded overflow-x-auto mt-2">
                  {JSON.stringify(c.business_hours || {}, null, 1)}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Holidays</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Recurring</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <EmptyState title="No holidays" description="Holidays pause SLA clocks within the business calendar." />
                    </TableCell>
                  </TableRow>
                )}
                {holidays.map((h) => (
                  <TableRow key={String(h.id)}>
                    <TableCell className="font-mono text-xs">{String(h.holiday_date)}</TableCell>
                    <TableCell className="text-sm">{String(h.name)}</TableCell>
                    <TableCell>{h.is_recurring ? <Badge variant="outline" className="text-[10px]">Yearly</Badge> : <span className="text-xs text-muted-foreground">Once</span>}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeHoliday(String(h.id))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}