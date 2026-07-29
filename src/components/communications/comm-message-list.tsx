"use client";

import { useEffect, useState } from "react";
import { RefreshCw, RotateCcw, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useUser } from "@/hooks/use-user";
import { listMessages, retryMessage, COMM_STATUSES } from "@/lib/communications";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export function CommMessageList({
  title,
  description,
  channel,
  statusFilter,
}: {
  title: string;
  description: string;
  channel?: string;
  statusFilter?: string;
}) {
  const { auth } = useUser();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [status, setStatus] = useState(statusFilter || "all");
  const [q, setQ] = useState("");

  const load = async () => {
    if (!auth?.profile?.company_id) { setLoading(false); return; }
    try {
      setRows(
        (await listMessages({
          companyId: auth.profile.company_id,
          channel: channel || "all",
          status,
          search: q,
          limit: 200,
        })) as Array<Record<string, unknown>>
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [auth, status, channel]);

  if (loading) return <LoadingState message={`Loading ${title}…`} />;

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button size="sm" variant="outline" onClick={() => load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => load()} />
        </div>
        {!statusFilter && (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {COMM_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No messages" description="Compose a message or wait for ERP events." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id as string}>
                  <TableCell className="font-mono text-xs">{String(r.message_number)}</TableCell>
                  <TableCell><Badge variant="outline">{String(r.channel)}</Badge></TableCell>
                  <TableCell className="text-sm max-w-[220px] truncate">{String(r.subject || "—")}</TableCell>
                  <TableCell className="text-xs max-w-[160px] truncate">{String(r.recipient_summary || "—")}</TableCell>
                  <TableCell><Badge variant={r.status === "failed" ? "destructive" : "secondary"}>{String(r.status)}</Badge></TableCell>
                  <TableCell className="text-xs">{formatDate(String(r.created_at))}</TableCell>
                  <TableCell>
                    {r.status === "failed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await retryMessage(r.id as string, auth?.user.id);
                          toast.success("Retried");
                          load();
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
