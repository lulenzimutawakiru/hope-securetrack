/**
 * Disaster Recovery drill checklist runner.
 * Records evidence JSON for SOC2/ISO — does not perform destructive restores.
 *
 * Usage:
 *   node scripts/dr-drill.mjs [baseUrl]
 *
 * Env:
 *   BASE_URL, DR_OPERATOR (name), DR_NOTES
 *
 * Writes docs/DR_DRILL_EVIDENCE.json
 */
import { writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const base = (process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);

const steps = [];

function record(id, title, status, detail = {}) {
  steps.push({
    id,
    title,
    status, // pass | fail | skip | manual
    at: new Date().toISOString(),
    ...detail,
  });
}

// 1. Health
try {
  const t0 = performance.now();
  const res = await fetch(`${base}/api/health`, { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  const ms = Math.round(performance.now() - t0);
  record("health", "GET /api/health", res.status < 500 ? "pass" : "fail", {
    httpStatus: res.status,
    latencyMs: ms,
    serviceStatus: json.status,
  });
} catch (e) {
  record("health", "GET /api/health", "fail", {
    error: e instanceof Error ? e.message : String(e),
  });
}

// 2. Login page reachable
try {
  const res = await fetch(`${base}/login`);
  record("login_ui", "Login page HTTP", res.ok || res.status < 500 ? "pass" : "fail", {
    httpStatus: res.status,
  });
} catch (e) {
  record("login_ui", "Login page HTTP", "fail", {
    error: e instanceof Error ? e.message : String(e),
  });
}

// 3. Migrations present
const migDir = join(root, "supabase", "migrations");
const migCount = existsSync(migDir)
  ? readdirSync(migDir).filter((f) => f.endsWith(".sql")).length
  : 0;
record("migrations", "SQL migrations on disk", migCount >= 60 ? "pass" : "fail", {
  count: migCount,
});

// 4. DR doc present
record(
  "dr_doc",
  "DISASTER_RECOVERY.md present",
  existsSync(join(root, "docs", "DISASTER_RECOVERY.md")) ? "pass" : "fail"
);

// 5. Manual restore steps (always manual)
const manual = [
  {
    id: "manual_backup",
    title: "Confirm Supabase backup / PITR available",
  },
  {
    id: "manual_restore_staging",
    title: "Restore snapshot to staging project/branch",
  },
  {
    id: "manual_env_point",
    title: "Point staging app env to restored DB",
  },
  {
    id: "manual_verify_login",
    title: "Verify login + company switch on staging",
  },
  {
    id: "manual_verify_rls",
    title: "Run two-user RLS isolation on staging",
  },
  {
    id: "manual_verify_payroll",
    title: "Open payroll runs + finance hub on staging",
  },
  {
    id: "manual_verify_portal",
    title: "Portal token access on staging",
  },
  {
    id: "manual_rto_rpo",
    title: "Record achieved RTO/RPO vs targets (RTO≤4h, RPO≤24h)",
  },
];

for (const m of manual) {
  record(m.id, m.title, "manual", {
    instruction: "Complete during quarterly drill and set status=pass in evidence",
  });
}

const auto = steps.filter((s) => s.status === "pass" || s.status === "fail");
const failed = auto.filter((s) => s.status === "fail");
const report = {
  generatedAt: new Date().toISOString(),
  product: "SecureTrack ERP",
  drillType: "quarterly-restore-checklist",
  operator: process.env.DR_OPERATOR || "unspecified",
  notes: process.env.DR_NOTES || "",
  baseUrl: base,
  targets: {
    RTO_hours: 4,
    RPO_hours: 24,
  },
  summary: {
    autoPass: auto.filter((s) => s.status === "pass").length,
    autoFail: failed.length,
    manualPending: steps.filter((s) => s.status === "manual").length,
  },
  steps,
  pass: failed.length === 0,
  nextDrillDue: (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().slice(0, 10);
  })(),
};

mkdirSync(join(root, "docs"), { recursive: true });
const out = join(root, "docs", "DR_DRILL_EVIDENCE.json");
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`Wrote ${out}`);
if (!report.pass) process.exit(1);
