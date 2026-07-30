/**
 * Write npm audit summary for compliance evidence.
 * Does not fail the process by default (exit 0) so CI can still soft-fail.
 * Set AUDIT_FAIL=true to exit 1 on high/critical.
 */
import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let raw = "";
try {
  raw = execSync("npm audit --json", {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 20 * 1024 * 1024,
  });
} catch (e) {
  // npm audit exits non-zero when vulns found
  raw = e.stdout?.toString?.() || e.output?.join?.("") || "{}";
}

let audit = {};
try {
  audit = JSON.parse(raw);
} catch {
  audit = { error: "Failed to parse npm audit JSON" };
}

const vulns = audit.vulnerabilities || {};
const list = Object.entries(vulns).map(([name, v]) => ({
  name,
  severity: v.severity,
  via: Array.isArray(v.via)
    ? v.via.map((x) => (typeof x === "string" ? x : x.title || x.name)).slice(0, 5)
    : [],
  range: v.range,
  fixAvailable: Boolean(v.fixAvailable),
}));

const counts = { critical: 0, high: 0, moderate: 0, low: 0, info: 0 };
for (const v of list) {
  if (counts[v.severity] != null) counts[v.severity]++;
}

const report = {
  generatedAt: new Date().toISOString(),
  product: "SecureTrack ERP",
  metadata: audit.metadata || {},
  counts,
  criticalAndHigh: list.filter((v) => v.severity === "critical" || v.severity === "high"),
  all: list,
  remediation:
    "Run `npm audit fix` for non-breaking fixes; review breaking changes with `npm audit fix --force` in a branch. Prefer dependency upgrades over force.",
  pass: counts.critical === 0 && counts.high === 0,
};

mkdirSync(join(root, "docs"), { recursive: true });
const outPath = join(root, "docs", "DEPENDENCY_AUDIT_REPORT.json");
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(
  JSON.stringify(
    {
      counts,
      criticalAndHigh: report.criticalAndHigh.length,
      pass: report.pass,
      wrote: "docs/DEPENDENCY_AUDIT_REPORT.json",
    },
    null,
    2
  )
);

if (process.env.AUDIT_FAIL === "true" && !report.pass) {
  process.exit(1);
}
