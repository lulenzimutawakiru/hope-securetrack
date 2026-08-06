"use client";

/**
 * SecureTrack AI Admin Assistant - natural-language queries over the control plane.
 * Read-only; every question is answered from the platform data layer behind
 * role-scoped API routes.
 */

import { useState } from "react";
import { Bot, Send, Sparkles, Loader2, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import type { AssistantResponse } from "@/lib/platform/admin-console";

const SUGGESTIONS = [
  "Show tenants with overdue payments",
  "Find security risks",
  "Generate revenue report",
  "Which tenants use the most resources?",
  "Show failed integrations",
  "Platform health status",
];

export default function AssistantPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Assistant request failed");
      }
      setResponse(json.data ?? json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Admin Assistant"
        description="Ask questions about billing, security, revenue, usage, and platform operations"
      />

      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(query);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Bot className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Try "Show tenants with overdue payments"'
                className="pl-9"
                maxLength={500}
                aria-label="Ask the admin assistant"
              />
            </div>
            <Button type="submit" disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Ask
            </Button>
          </form>

          {error && (
            <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuery(s);
                  ask(s);
                }}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Lightbulb className="h-3 w-3" />
                {s}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      {response && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                <Sparkles className="mr-1 h-3 w-3 text-hope-gold" />
                {response.intent.replace(/_/g, " ")}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {new Date(response.generated_at).toLocaleString()}
              </span>
            </div>

            <p className="text-sm leading-relaxed">{response.answer}</p>

            {response.facts.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {response.facts.map((f) => (
                  <div key={f.label} className="rounded-md border px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {f.label}
                    </p>
                    <p className="mt-0.5 text-lg font-semibold">
                      {typeof f.value === "number" ? formatNumber(f.value) : f.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {response.suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {response.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setQuery(s);
                      ask(s);
                    }}
                    className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-[10px] text-muted-foreground">
        The assistant answers from live, read-only platform snapshots. All queries are
        rate-limited and restricted to staff roles with the &quot;assistant&quot; capability.
      </p>
    </div>
  );
}