"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, RotateCcw, Search, ChevronRight, Send } from "lucide-react";
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
    if (!auth?.profile?.company_id) {
      setLoading(false);
      return;
    }
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
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => load()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/communications/compose">
                <Send className="h-4 w-4 mr-1" /> Compose
              </Link>
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search number, subject, recipient…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            onBlur={() => load()}
          />
        </div>
        {!statusFilter && (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {COMM_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
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
                <TableHead>Module</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const id = r.id as string;
                return (
                  <TableRow key={id} className="group">
                    <TableCell>
                      <Link
                        href={`/dashboard/communications/messages/${id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {String(r.message_number)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{String(r.channel)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate">
                      <Link
                        href={`/dashboard/communications/messages/${id}`}
                        className="hover:underline"
                      >
                        {String(r.subject || "—")}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs max-w-[160px] truncate">
                      {String(r.recipient_summary || "—")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {String(r.source_module || "—")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "failed"
                            ? "destructive"
                            : r.status === "sent" || r.status === "delivered"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {String(r.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDate(String(r.created_at))}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {r.status === "failed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await retryMessage(id, auth?.user.id);
                              toast.success("Queued for retry");
                              load();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Retry failed");
                            }
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/communications/messages/${id}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
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
