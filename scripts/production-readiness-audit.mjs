/**
 * SecureTrack ERP — Production readiness audit (static).
 * Scans routes, nav links, empty patterns, and critical files.
 * Usage: node scripts/production-readiness-audit.mjs
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const issues = [];
const info = [];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

// 1. Dashboard pages
const dashPages = walk(path.join(root, "src/app/dashboard")).filter((f) =>
  f.endsWith(`${path.sep}page.tsx`)
);
info.push(`Dashboard pages: ${dashPages.length}`);

// 2. API routes
const apiRoutes = walk(path.join(root, "src/app/api")).filter((f) =>
  f.endsWith(`${path.sep}route.ts`)
);
info.push(`API routes: ${apiRoutes.length}`);

// 3. Placeholder / TODO / mock patterns in dashboard
const badPatterns = [
  { re: /TODO\s*:\s*implement/i, label: "TODO implement" },
  { re: /coming soon/i, label: "coming soon" },
  { re: /lorem ipsum/i, label: "lorem ipsum" },
  { re: /mock data/i, label: "mock data" },
  { re: /placeholder only/i, label: "placeholder only" },
  { re: /not implemented/i, label: "not implemented" },
];

let placeholderHits = 0;
for (const f of dashPages.slice(0, 2000)) {
  const text = fs.readFileSync(f, "utf8");
  for (const p of badPatterns) {
    if (p.re.test(text)) {
      placeholderHits++;
      issues.push({
        severity: "medium",
        type: "placeholder",
        file: path.relative(root, f),
        detail: p.label,
      });
      break;
    }
  }
}
info.push(`Pages with placeholder-like text (sample scan): ${placeholderHits}`);

// 4. NAV items vs pages
const constantsPath = path.join(root, "src/lib/constants.ts");
const constants = fs.readFileSync(constantsPath, "utf8");
const hrefs = [...constants.matchAll(/href:\s*"(\/dashboard[^"]*)"/g)].map((m) => m[1]);
let missingNav = 0;
for (const href of hrefs) {
  const rel = href.replace(/^\//, ""); // dashboard/...
  const pageFile = path.join(root, "src/app", rel, "page.tsx");
  const pageFileIndex = path.join(root, "src/app", rel, "page.jsx");
  if (!fs.existsSync(pageFile) && !fs.existsSync(pageFileIndex)) {
    // dynamic segments may not match exactly
    if (!href.includes("[")) {
      missingNav++;
      issues.push({
        severity: "high",
        type: "dead_nav",
        file: "src/lib/constants.ts",
        detail: `NAV href missing page: ${href}`,
      });
    }
  }
}
info.push(`NAV hrefs checked: ${hrefs.length}; missing pages: ${missingNav}`);

// 5. Critical security files
const required = [
  "src/lib/security/api-auth.ts",
  "src/lib/security/dual-control.ts",
  "src/middleware.ts",
  ".github/workflows/ci.yml",
  "docs/DISASTER_RECOVERY.md",
  "docs/PRODUCTION_HARDENING_RUNBOOK.md",
  "docs/INDEPENDENT_ENTERPRISE_SECURITY_AUDIT.md",
];
for (const f of required) {
  if (!fs.existsSync(path.join(root, f))) {
    issues.push({ severity: "critical", type: "missing_control", file: f, detail: "required file missing" });
  }
}

// 6. Migrations presence
const migs = fs.readdirSync(path.join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql"));
info.push(`Migrations: ${migs.length}`);

// Report
const bySev = { critical: 0, high: 0, medium: 0, low: 0 };
for (const i of issues) bySev[i.severity] = (bySev[i.severity] || 0) + 1;

const report = {
  generatedAt: new Date().toISOString(),
  product: "SecureTrack ERP",
  summary: { ...bySev, total: issues.length },
  info,
  issues: issues.slice(0, 200),
};

const outDir = path.join(root, "docs");
fs.writeFileSync(
  path.join(outDir, "PRODUCTION_READINESS_AUDIT_REPORT.json"),
  JSON.stringify(report, null, 2)
);

console.log("=== SecureTrack ERP Production Readiness Audit ===");
for (const line of info) console.log(" ·", line);
console.log("Issues:", report.summary);
console.log("Wrote docs/PRODUCTION_READINESS_AUDIT_REPORT.json");

// Exit non-zero only on critical
if (bySev.critical > 0) process.exit(2);
process.exit(0);
