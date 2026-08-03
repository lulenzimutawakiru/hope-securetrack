"use client";

import { useState } from "react";
import {
  Search as SearchIcon, MessageSquare, Hash, Paperclip, CheckSquare, X, Loader2, FileSearch,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { searchChat } from "@/lib/hopechat";
import type { SearchHit } from "@/lib/hopechat";
import { cn } from "@/lib/utils";

const SCOPES = [
  { value: "all", label: "All" },
  { value: "messages", label: "Messages" },
  { value: "channels", label: "Channels" },
  { value: "files", label: "Files" },
  { value: "approvals", label: "Approvals" },
] as const;

const GROUP_META: Record<
  string,
  { label: string; icon: typeof MessageSquare }
> = {
  messages: { label: "Messages", icon: MessageSquare },
  channels: { label: "Channels", icon: Hash },
  files: { label: "Files", icon: Paperclip },
  approvals: { label: "Approvals", icon: CheckSquare },
};

export default function ChatSearchPage() {
  const { auth } = useUser();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<string>("all");
  const [allHits, setAllHits] = useState<SearchHit[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loaded, setLoaded] = useState(true);

  const companyId = auth?.profile?.company_id as string | undefined;

  const doSearch = async () => {
    if (!companyId) return;
    setSearching(true);
    try {
      const supabase = createClient();
      const [msgRes, chanRes, fileRes, apprRes] = await Promise.all([
        supabase
          .from("hc_messages")
          .select("id,channel_id,sender_name,body,message_type,created_at")
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .limit(600),
        supabase
          .from("hc_channels")
          .select("id,name,slug,description,department_code,channel_type")
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .eq("is_archived", false)
          .limit(300),
        supabase
          .from("hc_files")
          .select("id,file_name,file_type,file_size_bytes,created_at")
          .eq("company_id", companyId)
          .limit(300),
        supabase
          .from("hc_approvals")
          .select("id,entity_type,title,description,status,requester_name,approver_name,created_at")
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .limit(300),
      ]);

      const all = searchChat({
        query: q,
        channels: (chanRes.data as Array<Record<string, unknown>>) || [],
        messages: (msgRes.data as Array<Record<string, unknown>>) || [],
        files: (fileRes.data as Array<Record<string, unknown>>) || [],
        approvals: (apprRes.data as Array<Record<string, unknown>>) || [],
      });
      setAllHits(all);
      setHits(scope === "all" ? all : all.filter((h) => h.group === scope));
      setSearched(true);
    } catch {
      setAllHits([]);
      setHits([]);
      setSearched(true);
    } finally {
      setSearching(false);
      setLoaded(true);
    }
  };


  const grouped: Array<{ group: string; hits: SearchHit[] }> = Object.keys(GROUP_META)
    .map((g) => ({ group: g, hits: hits.filter((h) => h.group === g) }))
    .filter((g) => g.hits.length > 0);

  return (
    <div>
      <PageHeader
        title="Search Intelligence"
        description="Permission-scoped search across messages, channels, files and approvals"
      />

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doSearch();
              }}
              className="pl-9 pr-9"
              placeholder="Search discussions, files, approvals... e.g. 'supplier payment delays'"
            />
            {Boolean(q) && (
              <button
                onClick={() => {
                  setQ("");
                  setAllHits([]);
                  setHits([]);
                  setSearched(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {SCOPES.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  setScope(s.value);
                  if (searched && allHits.length > 0) {
                    setHits(
                      s.value === "all"
                        ? allHits
                        : allHits.filter((h) => h.group === s.value)
                    );
                  }
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  scope === s.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {s.label}
              </button>
            ))}
            <Button
              size="sm"
              onClick={doSearch}
              disabled={searching || !q.trim()}
              className="ml-auto"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <SearchIcon className="h-4 w-4 mr-1" />
              )}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {!loaded ? (
        <LoadingState message="Preparing search index..." />
      ) : !searched ? (
        <EmptyState
          icon={FileSearch}
          title="Search your workspace"
          description="Results are filtered by your permissions and company scope."
        />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="No results"
          description={`Nothing found for "${q}". Try different keywords.`}
        />
      ) : (
        <div className="grid gap-4">
          {grouped.map((g) => {
            const meta = GROUP_META[g.group];
            const Icon = meta.icon;
            return (
              <Card key={g.group}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {meta.label}
                    <Badge variant="secondary">{g.hits.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-1">
                  {g.hits.map((h) => (
                    <div
                      key={`${g.group}-${h.id}`}
                      className="flex items-start justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{h.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{h.subtitle}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {Boolean(h.meta) && (
                          <Badge variant="outline">{h.meta}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {Math.round(h.score * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}