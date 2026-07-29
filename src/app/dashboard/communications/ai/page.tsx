"use client";

import { useState } from "react";
import { Sparkles, Copy } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { aiDraftEmail } from "@/lib/communications";
import { toast } from "sonner";

export default function CommAiPage() {
  const [intent, setIntent] = useState("Request approval for purchase order exceeding limit");
  const [facts, setFacts] = useState("PO amount UGX 15,000,000. Supplier: Eastern Paper. Needed by Friday.");
  const [tone, setTone] = useState("professional");
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const d = await aiDraftEmail({ intent, facts, tone });
      setDraft(d);
      toast.success("Draft ready");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="AI Communication Assistant"
        description="Draft emails · summarize · suggest recipients · translate · urgency detection"
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Draft request</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Intent</Label>
              <Textarea value={intent} onChange={(e) => setIntent(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Facts / context</Label>
              <Textarea value={facts} onChange={(e) => setFacts(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={run} disabled={busy}>
              <Sparkles className="h-4 w-4 mr-1" />{busy ? "Drafting…" : "Generate draft"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Output</CardTitle>
            {draft && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
                  toast.success("Copied");
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {!draft ? (
              <p className="text-sm text-muted-foreground">Generate a draft to preview.</p>
            ) : (
              <>
                <div>
                  <Label>Subject</Label>
                  <Input readOnly value={draft.subject} />
                </div>
                <div>
                  <Label>Body</Label>
                  <Textarea readOnly rows={12} value={draft.body} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
