"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Camera,
  Keyboard,
  MapPin,
  Package,
  Calendar,
  Hash,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrScanner } from "@/components/verify/qr-scanner";
import { normalizeScanInput } from "@/lib/verification";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface VerificationResponse {
  result:
    | "genuine"
    | "invalid"
    | "counterfeit"
    | "recalled"
    | "duplicate"
    | "suspicious";
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
    bg: "bg-green-500/10 border-green-500/30",
    label: "Genuine Product",
    ring: "ring-green-500/30",
  },
  invalid: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500/10 border-red-500/30",
    label: "Invalid QR Code",
    ring: "ring-red-500/30",
  },
  counterfeit: {
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-600/10 border-red-600/30",
    label: "Counterfeit Detected",
    ring: "ring-red-600/30",
  },
  recalled: {
    icon: AlertTriangle,
    color: "text-orange-500",
    bg: "bg-orange-500/10 border-orange-500/30",
    label: "Product Recalled",
    ring: "ring-orange-500/30",
  },
  duplicate: {
    icon: AlertTriangle,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10 border-yellow-500/30",
    label: "Duplicate Scan",
    ring: "ring-yellow-500/30",
  },
  suspicious: {
    icon: AlertTriangle,
    color: "text-yellow-600",
    bg: "bg-yellow-600/10 border-yellow-600/30",
    label: "Suspicious Activity",
    ring: "ring-yellow-600/30",
  },
};

function VerifyPortalInner() {
  const searchParams = useSearchParams();
  const [qrInput, setQrInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [autoRan, setAutoRan] = useState(false);
  const [reportForm, setReportForm] = useState({
    name: "",
    email: "",
    phone: "",
    description: "",
    location: "",
  });
  const [geo, setGeo] = useState<{ latitude?: number; longitude?: number }>({});

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setGeo({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  const verify = useCallback(
    async (qrData: string, sourceOverride?: string) => {
      const normalized = normalizeScanInput(qrData);
      if (!normalized) return;

      setQrInput(normalized);
      setLoading(true);
      setResult(null);
      setReportSent(false);
      try {
        const response = await fetch("/api/public/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qr: normalized,
            source:
              sourceOverride ||
              (cameraOn ? "mobile_camera" : "web"),
            ...geo,
          }),
        });
        const data = await response.json();
        setResult(data);
        if (data.result === "counterfeit" || data.result === "invalid") {
          setShowReport(true);
        }
      } catch {
        setResult({
          result: "invalid",
          message: "Verification service unavailable. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    },
    [cameraOn, geo]
  );

  // Deep link: /verify?code=UUID (from printed labels)
  useEffect(() => {
    if (autoRan) return;
    const code =
      searchParams.get("code") ||
      searchParams.get("uuid") ||
      searchParams.get("c") ||
      searchParams.get("qr");
    if (code) {
      setAutoRan(true);
      verify(code, "deeplink");
    }
  }, [searchParams, verify, autoRan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (qrInput.trim()) verify(qrInput.trim());
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let publicUuid: string | undefined;
      try {
        const parsed = JSON.parse(qrInput);
        publicUuid = parsed.uuid;
      } catch {
        /* ignore */
      }
      const res = await fetch("/api/public/report-counterfeit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...reportForm, publicUuid }),
      });
      if (!res.ok) throw new Error("Report failed");
      setReportSent(true);
      setShowReport(false);
    } catch {
      alert("Could not submit report. Please email info@hopedesign.co.ke");
    }
  };

  const config = result ? resultConfig[result.result] : null;
  const ResultIcon = config?.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-hope-navy via-[#0d2847] to-hope-teal">
      <header className="container mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-hope-gold" />
          <div>
            <span className="text-lg font-bold text-white block leading-tight">
              Hope SecureTrack
            </span>
            <span className="text-[10px] text-white/50 uppercase tracking-wider">
              Product Verification Portal
            </span>
          </div>
        </Link>
        <Link href="/login">
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 text-white hover:bg-white/10"
          >
            Staff Login
          </Button>
        </Link>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl pb-20">
        <div className="text-center mb-8">
          <Badge className="mb-3 bg-hope-gold/20 text-hope-gold border-hope-gold/30 hover:bg-hope-gold/20">
            Official Hope Design Group Portal
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Verify Your Product
          </h1>
          <p className="text-white/70 max-w-lg mx-auto">
            Scan the SecureTrack QR label on your paper ream or carton to confirm
            authenticity and manufacturing details.
          </p>
        </div>

        <Card className="mb-6 border-0 shadow-2xl">
          <CardHeader>
            <CardTitle>How do you want to verify?</CardTitle>
            <CardDescription>
              Use your camera or paste QR code data from the label
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue="manual"
              onValueChange={(v) => setCameraOn(v === "camera")}
            >
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="manual" className="gap-2">
                  <Keyboard className="h-4 w-4" /> Enter Code
                </TabsTrigger>
                <TabsTrigger value="camera" className="gap-2">
                  <Camera className="h-4 w-4" /> Scan Camera
                </TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    placeholder="Paste code, serial (RM-…), UUID, or scan URL…"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    className="font-mono text-sm min-h-[44px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: scan the label QR, or enter the serial printed next to it.
                  </p>
                  <Button
                    type="submit"
                    className="w-full bg-hope-navy hover:bg-hope-navy/90"
                    disabled={loading || !qrInput.trim()}
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying…
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Verify Product
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="camera" className="space-y-4">
                {cameraOn && (
                  <QrScanner
                    active={cameraOn}
                    onScan={(text) => {
                      verify(text, "mobile_camera");
                    }}
                  />
                )}
                {loading && (
                  <p className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking authenticity…
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {result && config && ResultIcon && (
          <Card className={`border-2 ${config.bg} ring-4 ${config.ring} mb-6`}>
            <CardHeader className="text-center pb-2">
              <ResultIcon className={`h-16 w-16 mx-auto mb-3 ${config.color}`} />
              <CardTitle className="text-2xl">{config.label}</CardTitle>
              <CardDescription className="text-base">
                {result.safetyMessage || result.message}
              </CardDescription>
            </CardHeader>
            {result.result === "genuine" && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {result.product && (
                    <div className="rounded-lg bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" /> Product
                      </p>
                      <p className="font-medium text-sm mt-0.5">{result.product}</p>
                    </div>
                  )}
                  {result.paperSize && (
                    <div className="rounded-lg bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">Paper Size</p>
                      <p className="font-medium text-sm mt-0.5">{result.paperSize}</p>
                    </div>
                  )}
                  {result.gsm != null && (
                    <div className="rounded-lg bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">GSM</p>
                      <p className="font-medium text-sm mt-0.5">{result.gsm}</p>
                    </div>
                  )}
                  {result.batch && (
                    <div className="rounded-lg bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3 w-3" /> Batch
                      </p>
                      <p className="font-medium text-sm mt-0.5 font-mono">
                        {result.batch}
                      </p>
                    </div>
                  )}
                  {result.manufacturingDate && (
                    <div className="rounded-lg bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Manufactured
                      </p>
                      <p className="font-medium text-sm mt-0.5">
                        {result.manufacturingDate}
                      </p>
                    </div>
                  )}
                  {result.verificationCount !== undefined && (
                    <div className="rounded-lg bg-background/60 p-3">
                      <p className="text-xs text-muted-foreground">Scan count</p>
                      <p className="font-medium text-sm mt-0.5">
                        {result.verificationCount}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {result.isFirstScan && (
                    <Badge
                      variant="outline"
                      className="text-green-600 border-green-600"
                    >
                      First verification
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-hope-teal border-hope-teal">
                    Hope Design Group Ltd
                  </Badge>
                </div>
              </CardContent>
            )}
            {(result.result === "counterfeit" ||
              result.result === "invalid" ||
              result.result === "recalled") && (
              <CardContent>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setShowReport(true)}
                >
                  Report Suspected Issue
                </Button>
              </CardContent>
            )}
            <CardContent className="pt-0">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setResult(null);
                  setQrInput("");
                }}
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Verify another product
              </Button>
            </CardContent>
          </Card>
        )}

        {reportSent && (
          <Card className="mb-6 border-green-500/30 bg-green-500/10">
            <CardContent className="py-4 text-center text-sm">
              Thank you. Your report was submitted. Our team will investigate.
            </CardContent>
          </Card>
        )}

        {showReport && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Report Product Issue</CardTitle>
              <CardDescription>
                Help us protect customers and catch counterfeits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleReport} className="space-y-3">
                <Input
                  placeholder="Your name"
                  value={reportForm.name}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, name: e.target.value })
                  }
                  required
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={reportForm.email}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, email: e.target.value })
                  }
                />
                <Input
                  placeholder="Phone"
                  value={reportForm.phone}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, phone: e.target.value })
                  }
                />
                <Input
                  placeholder="Purchase location"
                  value={reportForm.location}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, location: e.target.value })
                  }
                />
                <textarea
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Describe the issue…"
                  value={reportForm.description}
                  onChange={(e) =>
                    setReportForm({ ...reportForm, description: e.target.value })
                  }
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

        <div className="grid sm:grid-cols-3 gap-3 text-center">
          {[
            {
              title: "Encrypted QR",
              desc: "Each unit has a unique signed code",
            },
            {
              title: "Live Check",
              desc: "Results checked against factory records",
            },
            {
              title: "Fraud Alerts",
              desc: "Suspicious scans are investigated",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/80"
            >
              <p className="font-semibold text-hope-gold text-sm">{item.title}</p>
              <p className="text-xs text-white/50 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>

        {geo.latitude && (
          <p className="text-center text-[10px] text-white/30 mt-6 flex items-center justify-center gap-1">
            <MapPin className="h-3 w-3" /> Location used only for fraud detection
          </p>
        )}
      </main>
    </div>
  );
}

export default function VerifyPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-hope-navy text-white">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <VerifyPortalInner />
    </Suspense>
  );
}
