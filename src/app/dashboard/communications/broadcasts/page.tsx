"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

export default function BroadcastsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await createClient()
          .from("notification_broadcasts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        setRows((data as Array<Record<string, unknown>>) || []);
      } catch {
        /* table may be empty */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingState message="Loading broadcasts…" />;

  return (
    <div>
      <PageHeader
        title="Broadcast Messages"
        description="Legacy notification broadcasts + new campaigns"
        actions={
          <Button asChild size="sm">
            <Link href="/dashboard/communications/campaigns">Campaign manager</Link>
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No legacy broadcasts"
          description="Use Campaign Manager for new multi-channel campaigns."
        />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id as string}>
                  <TableCell className="text-sm font-medium">{String(r.title)}</TableCell>
                  <TableCell><Badge variant="outline">{String(r.status)}</Badge></TableCell>
                  <TableCell className="text-xs">{String(r.sent_count ?? 0)}</TableCell>
                  <TableCell className="text-xs">{formatDate(String(r.created_at))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
