/**
 * Fail when UI code mutates Supabase via the browser client.
 * Also inventories remaining domain-lib browser writes (warning unless --lib-strict).
 *
 * Usage:
 *   node scripts/check-browser-writes.mjs [--strict] [--lib-strict]
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const strict =
  process.argv.includes("--strict") ||
  process.env.BROWSER_WRITE_STRICT === "true" ||
  process.env.CI === "true";
const libStrict =
  process.argv.includes("--lib-strict") ||
  process.env.BROWSER_WRITE_LIB_STRICT === "true";

/** Relative paths allowed to keep limited self-service browser writes (RLS-only). */
const ALLOWLIST = new Set([
  "src/app/dashboard/settings/profile/page.tsx",
  "src/app/dashboard/identity/self-service/page.tsx",
  "src/app/dashboard/identity/sessions/page.tsx",
  "src/app/dashboard/chat/notifications/page.tsx",
  "src/lib/offline/db.ts",
  "src/lib/offline/sync.ts",
  // Storage object API requires browser Supabase; table registry uses CRUD
  "src/lib/storage/upload.ts",
  // SecureChat: RLS membership + auth.uid() + Storage + composite upsert
  "src/lib/hopechat/service.ts",
  "src/lib/hopechat/enterprise.ts",
]);

/** Server-side modules that must not use the browser client for writes (enforced). */
const LIB_ENFORCED = [
  "src/lib/enterprise-company/",
  "src/lib/crm/service.ts",
  "src/lib/finance/service.ts",
  "src/lib/finance/engine.ts",
  "src/lib/assets/service.ts",
  "src/lib/attendance/engine.ts",
  "src/lib/attendance/ai.ts",
  "src/lib/audit/service.ts",
  "src/lib/audit/archive.ts",
  "src/lib/audit/policies.ts",
  "src/lib/audit/siem.ts",
  "src/lib/audit/reports.ts",
  "src/lib/payroll/service.ts",
  // Remaining domain modules (CRUD / crud-compat — no browser table writes)
  "src/lib/branding/service.ts",
  "src/lib/communications/service.ts",
  "src/lib/digital-identity/service.ts",
  "src/lib/dispatch/service.ts",
  "src/lib/fleet/service.ts",
  "src/lib/idm/service.ts",  "src/lib/idm/governance.ts",
  "src/lib/lbl/service.ts",
  "src/lib/mes/service.ts",
  "src/lib/packaging/service.ts",
  "src/lib/ppm/service.ts",
  "src/lib/print/service.ts",
  "src/lib/print/automation.ts",
  "src/lib/profile/service.ts",
  "src/lib/sales/service.ts",
  "src/lib/service-desk/service.ts",
  "src/lib/srm/service.ts",
  "src/lib/ta/service.ts",
  "src/lib/ta/activity.ts",
  "src/lib/tenant/service.ts",
  "src/lib/unified-identity/service.ts",
  "src/lib/contracts/service.ts",
  "src/lib/documents-brand.ts",
  "src/lib/platform/",
  "src/lib/system-settings.ts",
];

const WRITE_RE = /\.(insert|update|delete|upsert)\s*\(/g;
/** Only flag the browser Supabase client — server/admin createClient is allowed. */
const CLIENT_IMPORT_RE =
  /from\s+["']@\/lib\/supabase\/client["']/;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next") continue;
    if (ent.name === "__tests__" || ent.name.endsWith(".test.ts")) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts|jsx|js)$/.test(ent.name) && !ent.name.includes(".test."))
      acc.push(p);
  }
  return acc;
}

function isUiPath(rel) {
  return (
    rel.startsWith("src/app/dashboard/") ||
    rel.startsWith("src/components/") ||
    rel.startsWith("src/hooks/")
  );
}

function isLibEnforced(rel) {
  return LIB_ENFORCED.some((p) => rel.startsWith(p));
}

function findWriteHits(text) {
  WRITE_RE.lastIndex = 0;
  const hits = [];
  let m;
  while ((m = WRITE_RE.exec(text))) {
    const start = Math.max(0, m.index - 80);
    const ctx = text.slice(start, m.index + 40);
    if (/\.from\s*\(/.test(ctx) || /supabase|createClient|sb\s*\./.test(ctx)) {
      hits.push(m[1]);
    }
  }
  return [...new Set(hits)];
}

const scanRoots = [
  path.join(root, "src/app/dashboard"),
  path.join(root, "src/components"),
  path.join(root, "src/hooks"),
  path.join(root, "src/lib"),
];

const uiViolations = [];
const libViolations = [];
const libEnforcedViolations = [];

for (const scanRoot of scanRoots) {
  for (const file of walk(scanRoot)) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (ALLOWLIST.has(rel)) continue;
    // Server-only modules / CRUD engine are not browser writes
    if (rel.includes("/supabase/server") || rel.includes("crud-engine")) continue;
    const text = fs.readFileSync(file, "utf8");
    if (!CLIENT_IMPORT_RE.test(text) && !text.includes("supabase/client")) {
      continue;
    }
    const hits = findWriteHits(text);
    if (!hits.length) continue;
    const entry = { file: rel, methods: hits };
    if (isUiPath(rel)) uiViolations.push(entry);
    else if (isLibEnforced(rel)) libEnforcedViolations.push(entry);
    else if (rel.startsWith("src/lib/")) libViolations.push(entry);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  uiViolations: uiViolations.length,
  libEnforcedViolations: libEnforcedViolations.length,
  libDebtViolations: libViolations.length,
  ui: uiViolations.slice(0, 100),
  libEnforced: libEnforcedViolations.slice(0, 50),
  libDebt: libViolations.slice(0, 100),
  allowlist: [...ALLOWLIST],
};

fs.writeFileSync(
  path.join(root, "docs", "BROWSER_WRITE_AUDIT.json"),
  JSON.stringify(report, null, 2)
);

console.log("=== Browser Supabase write audit ===");
console.log(` UI violations (must be 0): ${uiViolations.length}`);
for (const v of uiViolations.slice(0, 20)) {
  console.log(`  [UI] ${v.file}: ${v.methods.join(", ")}`);
}
console.log(
  ` Lib enforced (${LIB_ENFORCED.length} paths): ${libEnforcedViolations.length}`
);
for (const v of libEnforcedViolations) {
  console.log(`  [LIB-ENFORCED] ${v.file}: ${v.methods.join(", ")}`);
}
console.log(` Lib debt (inventory only): ${libViolations.length}`);
for (const v of libViolations.slice(0, 15)) {
  console.log(`  [LIB] ${v.file}: ${v.methods.join(", ")}`);
}
if (libViolations.length > 15) {
  console.log(`  … and ${libViolations.length - 15} more (see report)`);
}

const failUi = strict && uiViolations.length > 0;
const failLibEnforced =
  (strict || libStrict) && libEnforcedViolations.length > 0;
const failLibAll = libStrict && libViolations.length > 0;

if (failUi || failLibEnforced || failLibAll) {
  console.error(
    "FAIL: Browser Supabase writes found. Route mutations through /api/v2/crud or domain APIs."
  );
  process.exit(2);
}

if (uiViolations.length || libEnforcedViolations.length || libViolations.length) {
  console.warn("WARN: residual browser writes (see docs/BROWSER_WRITE_AUDIT.json)");
}
process.exit(0);
