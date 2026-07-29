"use client";

import { useState } from "react";
import { Package, Scan } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { REAMS_PER_CARTON } from "@/lib/constants";
import { toast } from "sonner";

export default function PackingPage() {
  const { auth } = useUser();
  const [serials, setSerials] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [packing, setPacking] = useState(false);
  const [result, setResult] = useState<{
    serial: string;
    reams: string[];
  } | null>(null);

  const addSerial = () => {
    const s = input.trim().toUpperCase();
    if (!s) return;
    if (serials.includes(s)) {
      toast.error("Serial already added");
      return;
    }
    if (serials.length >= REAMS_PER_CARTON) {
      toast.error(`Maximum ${REAMS_PER_CARTON} reams per carton`);
      return;
    }
    setSerials([...serials, s]);
    setInput("");
  };

  const removeSerial = (s: string) => {
    setSerials(serials.filter((x) => x !== s));
  };

  const handlePack = async () => {
    if (serials.length !== REAMS_PER_CARTON || !auth) return;
    setPacking(true);
    setResult(null);
    try {
      const supabase = createClient();

      const { data: reams, error: reamsError } = await supabase
        .from("reams")
        .select("id, serial_number, qr_code_id")
        .in("serial_number", serials);

      if (reamsError || !reams || reams.length !== REAMS_PER_CARTON) {
        toast.error("Could not find all ream serials in the system");
        return;
      }

      const reamQrIds = reams.map((r) => r.qr_code_id).filter(Boolean);
      if (reamQrIds.length !== REAMS_PER_CARTON) {
        toast.error("Some reams are missing QR codes");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cartonize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            reamQrIds,
            packedBy: auth.profile.id,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "Packing failed");
      }

      toast.success(`Carton ${data.carton.serial} packed successfully`);
      setResult({ serial: data.carton.serial, reams: data.carton.reams });
      setSerials([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Packing failed");
    } finally {
      setPacking(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Packing Station"
        description={`Scan ${REAMS_PER_CARTON} reams of the same product/batch to form a carton`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/packaging">Enterprise Packaging</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              Scan Reams
            </CardTitle>
            <CardDescription>
              Enter or scan ream serial numbers ({serials.length}/{REAMS_PER_CARTON})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addSerial();
              }}
              className="flex gap-2"
            >
              <Input
                placeholder="RM-20260101-00001"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="font-mono"
                autoFocus
              />
              <Button type="submit" disabled={!input.trim()}>
                Add
              </Button>
            </form>

            <div className="space-y-2 min-h-[200px]">
              {serials.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No reams scanned yet
                </p>
              ) : (
                serials.map((s, i) => (
                  <div
                    key={s}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <span className="font-mono text-sm">
                      {i + 1}. {s}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSerial(s)}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={serials.length !== REAMS_PER_CARTON || packing}
                onClick={handlePack}
              >
                <Package className="mr-2 h-4 w-4" />
                {packing ? "Packing..." : "Pack Carton"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSerials([]);
                  setResult(null);
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Last Carton</CardTitle>
            <CardDescription>Result of the most recent packing operation</CardDescription>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mb-3 opacity-40" />
                <p className="text-sm">Pack a carton to see results here</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Carton Serial</p>
                  <p className="text-2xl font-mono font-bold text-hope-teal">
                    {result.serial}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Packed Reams</p>
                  <div className="flex flex-wrap gap-2">
                    {result.reams.map((r) => (
                      <Badge key={r} variant="outline" className="font-mono">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
