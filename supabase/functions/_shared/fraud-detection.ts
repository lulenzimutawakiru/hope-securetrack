import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

interface FraudContext {
  ip: string;
  latitude?: number;
  longitude?: number;
  isFirstScan: boolean;
}

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function detectFraud(
  supabase: SupabaseClient,
  qrCode: Record<string, unknown>,
  context: FraudContext
): Promise<void> {
  const alerts: Array<{
    alert_type: string;
    severity: string;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
  }> = [];

  const { count: scanCount } = await supabase
    .from("verification_logs")
    .select("*", { count: "exact", head: true })
    .eq("qr_code_id", qrCode.id);

  const duplicateThreshold = 10;
  if ((scanCount || 0) > duplicateThreshold) {
    alerts.push({
      alert_type: "excessive_scans",
      severity: "medium",
      title: "Excessive verification scans detected",
      description: `QR ${qrCode.human_serial} has been scanned ${scanCount} times`,
      evidence: { scan_count: scanCount, threshold: duplicateThreshold },
    });
  }

  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { count: recentScans } = await supabase
    .from("verification_logs")
    .select("*", { count: "exact", head: true })
    .eq("qr_code_id", qrCode.id)
    .gte("verified_at", oneHourAgo);

  if ((recentScans || 0) > 5) {
    alerts.push({
      alert_type: "scan_frequency",
      severity: "high",
      title: "Abnormal scan frequency",
      description: `${recentScans} scans in the last hour for ${qrCode.human_serial}`,
      evidence: { recent_scans: recentScans, window: "1h" },
    });
  }

  if (context.latitude && context.longitude) {
    const { data: lastScan } = await supabase
      .from("verification_logs")
      .select("latitude, longitude, verified_at")
      .eq("qr_code_id", qrCode.id)
      .not("latitude", "is", null)
      .order("verified_at", { ascending: false })
      .limit(1)
      .single();

    if (lastScan?.latitude && lastScan?.longitude) {
      const distance = haversineDistance(
        lastScan.latitude, lastScan.longitude,
        context.latitude, context.longitude
      );
      const geoThreshold = 500;
      const timeDiff =
        (Date.now() - new Date(lastScan.verified_at).getTime()) / 3600000;

      if (distance > geoThreshold && timeDiff < 24) {
        alerts.push({
          alert_type: "impossible_movement",
          severity: "critical",
          title: "Impossible geographic movement detected",
          description: `Product moved ${distance.toFixed(0)}km in ${timeDiff.toFixed(1)} hours`,
          evidence: {
            distance_km: distance,
            time_hours: timeDiff,
            from: { lat: lastScan.latitude, lng: lastScan.longitude },
            to: { lat: context.latitude, lng: context.longitude },
          },
        });
      }
    }
  }

  for (const alert of alerts) {
    await supabase.from("fraud_alerts").insert({
      company_id: qrCode.company_id,
      qr_code_id: qrCode.id,
      ...alert,
      status: "open",
    });
  }
}
