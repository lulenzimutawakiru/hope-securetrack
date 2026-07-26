"use client";

import { useState, useCallback } from "react";
import { Shield, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface VerificationResponse {
  result: "genuine" | "invalid" | "counterfeit" | "recalled" | "duplicate" | "suspicious";
  product?: string;
  paperSize?: string;
  gsm?: number;
  batch?: string;
  manufacturingDate?: string;
  verificationCount?: number;
  verifiedAt?: string;
  isFirstScan?: boolean;
  safetyMessage?: string;
  message?: string;
}

const resultConfig = {
  genuine: {
    icon: CheckCircle2,
    color: "text-green-500",
    bg: "bg-green-500/10 border-green-500/20",
    label: "Genuine Product",
  },
  invalid: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500/10 border-red-500/20",
    label: "Invalid QR Code",
  },
  counterfeit: {
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-600/10 border-red-600/20",
    label: "Counterfeit Detected",
  },
  recalled: {
    icon: AlertTriangle,
    color: "text-orange-500",
    bg: "bg-orange-500/10 border-orange-500/20",
    label: "Product Recalled",
  },
  duplicate: {
    icon: AlertTriangle,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    label: "Duplicate Scan",
  },
  suspicious: {
    icon: AlertTriangle,
    color: "text-yellow-600",
    bg: "bg-yellow-600/10 border-yellow-600/20",
    label: "Suspicious Activity",
  },
};

export default function VerifyPage() {
  const [qrInput, setQrInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportForm, setReportForm] = useState({
    name: "",
    email: "",
    phone: "",
    description: "",
    location: "",
  });

  const verify = useCallback(async (qrData: string) => {
    setLoading(true);
    setResult(null);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr: qrData,
          source: "web",
        }),
      });
      const data = await response.json();
      setResult(data);
    } catch {
      setResult({
        result: "invalid",
        message: "Verification service unavailable. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (qrInput.trim()) verify(qrInput.trim());
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    alert("Report submitted. Our team will investigate.");
    setShowReport(false);
  };

  const config = result ? resultConfig[result.result] : null;
  const ResultIcon = config?.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-hope-navy to-hope-teal">
      <header className="container mx-auto px-6 py-6">
        <Link href="/" className="flex items-center gap-3 w-fit">
          <Shield className="h-8 w-8 text-hope-gold" />
          <span className="text-lg font-bold text-white">Hope SecureTrack</span>
        </Link>
      </header>

      <main className="container mx-auto px-6 py-12 max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-3">Product Verification</h1>
          <p className="text-white/70">
            Scan or enter your QR code to verify product authenticity
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Enter QR Code Data</CardTitle>
            <CardDescription>
              Paste the QR code content or scan with your device camera
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                placeholder='{"version":1,"type":"REAM",...}'
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                className="font-mono text-sm"
              />
              <Button type="submit" className="w-full" disabled={loading || !qrInput.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Product"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && config && ResultIcon && (
          <Card className={`border-2 ${config.bg}`}>
            <CardHeader className="text-center">
              <ResultIcon className={`h-16 w-16 mx-auto mb-4 ${config.color}`} />
              <CardTitle className="text-2xl">{config.label}</CardTitle>
              <CardDescription className="text-base">
                {result.safetyMessage || result.message}
              </CardDescription>
            </CardHeader>
            {result.result === "genuine" && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {result.product && (
                    <div>
                      <p className="text-sm text-muted-foreground">Product</p>
                      <p className="font-medium">{result.product}</p>
                    </div>
                  )}
                  {result.paperSize && (
                    <div>
                      <p className="text-sm text-muted-foreground">Paper Size</p>
                      <p className="font-medium">{result.paperSize}</p>
                    </div>
                  )}
                  {result.gsm && (
                    <div>
                      <p className="text-sm text-muted-foreground">GSM</p>
                      <p className="font-medium">{result.gsm}</p>
                    </div>
                  )}
                  {result.batch && (
                    <div>
                      <p className="text-sm text-muted-foreground">Batch</p>
                      <p className="font-medium">{result.batch}</p>
                    </div>
                  )}
                  {result.manufacturingDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">Manufacturing Date</p>
                      <p className="font-medium">{result.manufacturingDate}</p>
                    </div>
                  )}
                  {result.verificationCount !== undefined && (
                    <div>
                      <p className="text-sm text-muted-foreground">Verification Count</p>
                      <p className="font-medium">{result.verificationCount}</p>
                    </div>
                  )}
                </div>
                {result.isFirstScan && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    First Verification
                  </Badge>
                )}
              </CardContent>
            )}
            {(result.result === "counterfeit" || result.result === "invalid") && (
              <CardContent>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setShowReport(true)}
                >
                  Report Suspected Counterfeit
                </Button>
              </CardContent>
            )}
          </Card>
        )}

        {showReport && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Report Counterfeit Product</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleReport} className="space-y-4">
                <Input
                  placeholder="Your Name"
                  value={reportForm.name}
                  onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                  required
                />
                <Input
                  type="email"
                  placeholder="Email Address"
                  value={reportForm.email}
                  onChange={(e) => setReportForm({ ...reportForm, email: e.target.value })}
                />
                <Input
                  placeholder="Phone Number"
                  value={reportForm.phone}
                  onChange={(e) => setReportForm({ ...reportForm, phone: e.target.value })}
                />
                <Input
                  placeholder="Purchase Location"
                  value={reportForm.location}
                  onChange={(e) => setReportForm({ ...reportForm, location: e.target.value })}
                />
                <textarea
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Describe the issue..."
                  value={reportForm.description}
                  onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                  required
                />
                <div className="flex gap-2">
                  <Button type="submit" variant="destructive" className="flex-1">
                    Submit Report
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowReport(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
