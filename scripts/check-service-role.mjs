/**
 * Inventory createAdminClient() usage and require documented isolation.
 * Fails in strict mode if authenticated API routes use admin without
 * company_id filter / scoped-admin import.
 *
 * Usage: node scripts/check-service-role.mjs [--strict]
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const strict =
  process.argv.includes("--strict") ||
  process.env.SERVICE_ROLE_STRICT === "true" ||
  process.env.CI === "true";

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

const apiFiles = walk(path.join(root, "src/app/api")).filter((f) =>
  f.endsWith(`route.ts`)
);
const libFiles = walk(path.join(root, "src/lib"));

const inventory = [];
const risks = [];

/** Public / device / worker paths where service role is expected */
const EXPECTED_ADMIN_PREFIXES = [
  "src/app/api/public/",
  "src/app/api/attendance/devices/",
  "src/app/api/jobs/worker/",
  "src/app/api/v2/servicedesk/sla/cron/",
];

function isExpected(rel) {
  return EXPECTED_ADMIN_PREFIXES.some((p) => rel.replace(/\\/g, "/").startsWith(p));
}

for (const file of [...apiFiles, ...libFiles]) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes("createAdminClient")) continue;
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const usesScoped =
    text.includes("scoped-admin") ||
    text.includes("createScopedAdmin") ||
    text.includes("adminGetById") ||
    text.includes("adminInsert") ||
    text.includes("adminUpdateById");
  const hasCompanyFilter =
    /\.eq\(\s*["']company_id["']/.test(text) ||
    text.includes("ctx.companyId") ||
    text.includes("company_id:");
  const isPublic = isExpected(rel);

  inventory.push({
    file: rel,
    usesScoped,
    hasCompanyFilter,
    expectedAdmin: isPublic,
  });

  // Authenticated API routes that use admin without company filter are high risk
  if (
    rel.startsWith("src/app/api/") &&
    !isPublic &&
    text.includes("createAdminClient") &&
    !hasCompanyFilter &&
    !usesScoped
  ) {
    risks.push({
      severity: "high",
      file: rel,
      detail: "createAdminClient without company_id filter or scoped-admin",
    });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  totalAdminUsages: inventory.length,
  risks,
  inventory: inventory.slice(0, 200),
};

fs.writeFileSync(
  path.join(root, "docs", "SERVICE_ROLE_AUDIT.json"),
  JSON.stringify(report, null, 2)
);

console.log("=== Service-role usage audit ===");
console.log(` createAdminClient sites: ${inventory.length}`);
console.log(` High-risk (no company filter): ${risks.length}`);
for (const r of risks.slice(0, 20)) {
  console.log(`  - ${r.file}: ${r.detail}`);
}
console.log(" Wrote docs/SERVICE_ROLE_AUDIT.json");

if (strict && risks.length > 0) {
  console.error("FAIL: unscoped service-role usage in authenticated APIs");
  process.exit(2);
}

process.exit(0);
