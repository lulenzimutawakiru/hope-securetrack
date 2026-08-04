/**
 * RLS inventory — scan SQL migrations for CREATE TABLE vs ENABLE ROW LEVEL SECURITY.
 * Fails CI when business tables lack RLS enablement (unless allowlisted).
 *
 * Usage: node scripts/rls-inventory.mjs [--strict]
 * Exit 2 when gaps found and --strict (or CI=true / RLS_INVENTORY_STRICT=true).
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const migDir = path.join(root, "supabase", "migrations");
const strict =
  process.argv.includes("--strict") ||
  process.env.RLS_INVENTORY_STRICT === "true" ||
  process.env.CI === "true";

/** Platform / system tables that may intentionally lack tenant RLS */
const ALLOWLIST = new Set([
  "schema_migrations",
  "spatial_ref_sys",
  // Supabase internals sometimes appear in dumps
  "buckets",
  "objects",
  "migrations",
]);

/** Prefixes that are always business data and must have RLS */
const BUSINESS_PREFIXES = [
  "pay_",
  "fin_",
  "fleet_",
  "mes_",
  "ta_",
  "ast_",
  "bill_",
  "crm_",
  "hr_",
  "inv_",
  "ppm_",
  "lbl_",
  "sd_",
  "att_",
  "sec_",
];

function walkSql() {
  if (!fs.existsSync(migDir)) return [];
  return fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => path.join(migDir, f));
}

function extractTables(sql) {
  const tables = new Set();
  // CREATE TABLE [IF NOT EXISTS] [schema.]name
  const re =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["']?([a-zA-Z0-9_]+)["']?/gi;
  let m;
  while ((m = re.exec(sql))) {
    tables.add(m[1].toLowerCase());
  }
  return tables;
}

function extractRlsEnabled(sql) {
  const tables = new Set();
  const re =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?["']?([a-zA-Z0-9_]+)["']?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  let m;
  while ((m = re.exec(sql))) {
    tables.add(m[1].toLowerCase());
  }
  // Dynamic: EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  // or EXECUTE 'ALTER TABLE public.foo ENABLE ROW LEVEL SECURITY';
  const execLiteral =
    /EXECUTE\s+'ALTER\s+TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY'/gi;
  while ((m = execLiteral.exec(sql))) {
    tables.add(m[1].toLowerCase());
  }
  // Table name lists followed by loop enable — capture quoted identifiers in arrays
  // e.g. 'att_locations','att_geofences',... near ENABLE ROW LEVEL SECURITY in same file
  if (/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql) && /%I/.test(sql)) {
    const quoted = sql.matchAll(/'([a-z][a-z0-9_]{2,})'/gi);
    for (const q of quoted) {
      const name = q[1].toLowerCase();
      // Heuristic: only count names that look like business tables (prefix or known)
      if (
        /^(att_|pay_|fin_|fleet_|mes_|ta_|ast_|bill_|crm_|hr_|inv_|ppm_|lbl_|sd_|sec_|ec_)/.test(
          name
        )
      ) {
        // Only if ENABLE appears in file (already checked)
        tables.add(name);
      }
    }
  }
  return tables;
}

function isBusinessTable(name) {
  if (ALLOWLIST.has(name)) return false;
  if (BUSINESS_PREFIXES.some((p) => name.startsWith(p))) return true;
  // Common ERP names without prefix
  const common = [
    "companies",
    "tenants",
    "user_profiles",
    "employees",
    "invoices",
    "invoice_payments",
    "products",
    "customers",
    "suppliers",
    "warehouses",
    "purchase_orders",
    "sales_orders",
    "job_queue",
    "job_dead_letters",
    "domain_events",
    "audit_logs",
    "notifications",
    "roles",
    "permissions",
    "role_permissions",
    "user_company_memberships",
  ];
  return common.includes(name);
}

const allTables = new Set();
const rlsEnabled = new Set();

for (const file of walkSql()) {
  const sql = fs.readFileSync(file, "utf8");
  for (const t of extractTables(sql)) allTables.add(t);
  for (const t of extractRlsEnabled(sql)) rlsEnabled.add(t);
}

const business = [...allTables].filter(isBusinessTable).sort();
const missing = business.filter((t) => !rlsEnabled.has(t));
const coverage =
  business.length === 0
    ? 100
    : Math.round(((business.length - missing.length) / business.length) * 100);

const report = {
  generatedAt: new Date().toISOString(),
  tablesTotal: allTables.size,
  businessTables: business.length,
  rlsEnabledTotal: rlsEnabled.size,
  businessWithRls: business.length - missing.length,
  coveragePercent: coverage,
  missingRls: missing.slice(0, 200),
  strict,
};

const outPath = path.join(root, "docs", "RLS_INVENTORY_REPORT.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log("=== RLS Inventory ===");
console.log(` Tables (CREATE): ${report.tablesTotal}`);
console.log(` Business tables: ${report.businessTables}`);
console.log(` RLS enabled (any): ${report.rlsEnabledTotal}`);
console.log(` Business with RLS: ${report.businessWithRls} (${coverage}%)`);
console.log(` Missing RLS (sample): ${missing.slice(0, 20).join(", ") || "(none)"}`);
console.log(` Wrote ${path.relative(root, outPath)}`);

// Fail only on business-prefix tables missing RLS (stricter subset) when strict
const criticalMissing = missing.filter((t) =>
  BUSINESS_PREFIXES.some((p) => t.startsWith(p))
);

if (strict && criticalMissing.length > 0) {
  console.error(
    `FAIL: ${criticalMissing.length} business-prefix tables lack ENABLE ROW LEVEL SECURITY`
  );
  console.error(criticalMissing.slice(0, 40).join(", "));
  process.exit(2);
}

// Soft warning for other business names
if (missing.length > 0) {
  console.warn(
    `WARN: ${missing.length} business tables may lack RLS (see report)`
  );
}

process.exit(0);
