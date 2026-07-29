"use client";

import { useEffect, useState } from "react";
import { Radio, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { processEventPipeline, INTEGRATION_EVENTS } from "@/lib/integration";

export default function EventsPage() {
  const { auth } = useUser();
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [eventType, setEventType] = useState<string>(INTEGRATION_EVENTS[2]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("intg_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setEvents(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const publish = async () => {
    if (!auth?.profile?.company_id) return;
    try {
      const supabase = createClient();
      await processEventPipeline(supabase, auth.profile.company_id, eventType, {
        source_module: "manual",
        published_by: auth.profile.id,
      });
      toast.success(`Published ${eventType}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (loading) return <LoadingState message="Loading event bus…" />;

  return (
    <div>
      <PageHeader
        title="Event Bus"
        description="Publish domain events · webhooks · workflows · queue pipeline"
        actions={
          <div className="flex gap-2 items-center">
            <div className="w-56">
              <Label className="sr-only">Event</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTEGRATION_EVENTS.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={publish}>
              <Send className="h-4 w-4 mr-1" /> Publish
            </Button>
          </div>
        }
      />
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e) => (
              <TableRow key={String(e.id)}>
                <TableCell className="font-mono text-xs flex items-center gap-1">
                  <Radio className="h-3 w-3" /> {String(e.event_type)}
                </TableCell>
                <TableCell className="text-xs">{String(e.source_module || "—")}</TableCell>
                <TableCell className="text-xs">{String(e.entity_type || "—")}</TableCell>
                <TableCell><StatusBadge status={String(e.status)} /></TableCell>
                <TableCell className="text-xs">{new Date(String(e.created_at)).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
