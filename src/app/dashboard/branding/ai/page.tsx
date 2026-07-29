"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wand2, Copy, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  generateBrandInsights,
  generateMarketingCopy,
  type BrandAiInsight,
} from "@/lib/branding";

export default function BrandAiPage() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<BrandAiInsight[]>([]);
  const [productName, setProductName] = useState("Premium A4 Copy Paper");
  const [tone, setTone] = useState<"professional" | "bold" | "friendly">("professional");
  const [copy, setCopy] = useState<{ headline: string; body: string; cta: string } | null>(null);
  const [brandName, setBrandName] = useState("Hope Design Group");

  useEffect(() => {
    async function load() {
      const sb = createClient();
      const [
        { data: brand },
        { count: assets },
        { count: pending },
        { count: issues },
        { count: published },
        { data: colors },
      ] = await Promise.all([
        sb.from("brand_profiles").select("brand_name").eq("is_primary", true).is("deleted_at", null).limit(1).maybeSingle(),
        sb.from("brand_assets").select("*", { count: "exact", head: true }).is("deleted_at", null),
        sb.from("brand_approvals").select("*", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("brand_compliance_issues").select("*", { count: "exact", head: true }).eq("status", "open"),
        sb.from("brand_templates").select("*", { count: "exact", head: true }).eq("status", "published"),
        sb.from("brand_colors").select("hex_value,color_role").eq("color_role", "primary").limit(1),
      ]);
      const name = brand?.brand_name || "Hope Design Group";
      setBrandName(name);
      setInsights(
        generateBrandInsights({
          brandName: name,
          primaryColor: colors?.[0]?.hex_value,
          assetCount: assets ?? 0,
          pendingApprovals: pending ?? 0,
          openIssues: issues ?? 0,
          publishedTemplates: published ?? 0,
        })
      );
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const genCopy = () => {
    const result = generateMarketingCopy({ productName, brandName, tone });
    setCopy(result);
    toast.success("Marketing copy generated");
  };

  const copyText = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  if (loading) return <LoadingState message="Loading AI brand assistant…" />;

  const severityColor = (s: string) => {
    if (s === "high") return "destructive";
    if (s === "medium") return "default";
    return "outline";
  };

  return (
    <div>
      <PageHeader
        title="AI Brand Assistant"
        description="Design concepts · compliance checks · marketing copy · labels"
      />

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Brand insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((ins, i) => (
              <div key={i} className="rounded-md border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={severityColor(ins.severity) as "outline" | "default" | "destructive"} className="text-[10px]">
                    {ins.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">{ins.type}</Badge>
                </div>
                <p className="font-medium text-sm">{ins.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{ins.detail}</p>
                {ins.sample ? (
                  <pre className="mt-2 text-[11px] bg-muted/50 p-2 rounded whitespace-pre-wrap font-mono">
                    {ins.sample}
                  </pre>
                ) : null}
                <div className="flex flex-wrap gap-1 mt-2">
                  {ins.actions.map((a) => (
                    <Badge key={a} variant="secondary" className="text-[10px] font-normal">{a}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Content generation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Product name</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
            </div>
            <div>
              <Label>Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="bold">Bold</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={genCopy} size="sm">Generate marketing copy</Button>
            {copy && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="font-semibold">{copy.headline}</p>
                <p className="text-sm text-muted-foreground">{copy.body}</p>
                <p className="text-sm font-medium text-primary">{copy.cta}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyText(`${copy.headline}\n\n${copy.body}\n\n${copy.cta}`)}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy all
                </Button>
              </div>
            )}
            <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
              <p>Quick links:</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline"><Link href="/dashboard/branding/designer">Designer</Link></Button>
                <Button asChild size="sm" variant="outline"><Link href="/dashboard/branding/compliance">Compliance</Link></Button>
                <Button asChild size="sm" variant="outline"><Link href="/dashboard/branding/colors">Colors</Link></Button>
                <Button asChild size="sm" variant="outline"><Link href="/dashboard/branding/email">Email signatures</Link></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
