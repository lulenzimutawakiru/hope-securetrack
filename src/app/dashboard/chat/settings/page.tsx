"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/crud-compat";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { crudCreate, crudUpdate } from "@/lib/api/crud-client";
import { BOT_DOMAINS } from "@/lib/hopechat";

export default function SecureChatSettingsPage() {
  const { auth } = useUser();
  const [theme, setTheme] = useState("system");
  const [density, setDensity] = useState("comfortable");
  const [dnd, setDnd] = useState(false);
  const [bots, setBots] = useState<Array<Record<string, unknown>>>([]);

  const companyId = auth?.profile?.company_id as string | undefined;
  const userId = auth?.profile?.id as string | undefined;

  useEffect(() => {
    createClient()
      .from("hc_bots")
      .select("*")
      .eq("is_active", true)
      .then(({ data }) => setBots((data as Array<Record<string, unknown>>) || []));

    if (!userId) return;
    createClient()
      .from("hc_user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTheme(String(data.theme || "system"));
          setDensity(String(data.density || "comfortable"));
          setDnd(!!data.dnd_enabled);
        }
      });
  }, [userId]);

  const save = async () => {
    if (!companyId || !userId) return;
    try {
      const { data: existing } = await createClient()
        .from("hc_user_settings")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        await crudUpdate("hc_user_settings", existing.id, { theme, density, dnd_enabled: dnd });
      } else {
        await crudCreate("hc_user_settings", {
          company_id: companyId,
          user_id: userId,
          theme,
          density,
          dnd_enabled: dnd,
        });
      }
      toast.success("SecureChat preferences saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="SecureChat Settings"
        description="Theme · density · DND · notifications · bots · retention policies"
        actions={
          <Button asChild size="sm" variant="outline"><Link href="/dashboard/chat">Chat</Link></Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" /> Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Density</Label>
              <Select value={density} onValueChange={setDensity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">Comfortable</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={dnd} onChange={(e) => setDnd(e.target.checked)} />
              Do Not Disturb
            </label>
            <Button size="sm" onClick={save}>Save</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Bots</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(bots.length ? bots : BOT_DOMAINS.map((b) => ({ bot_code: b.value, name: b.label, domain: b.value }))).map((b) => (
              <div key={String(b.bot_code || b.name)} className="flex justify-between border-b py-1">
                <span>{String(b.name)}</span>
                <span className="text-xs text-muted-foreground font-mono">{String(b.domain || b.bot_code)}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2">
              Security: TLS in transit · AES-at-rest via Supabase · optional E2E flags on private DMs ·
              immutable audit log · MFA via Identity module · retention via admin policies.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
