/**
 * Append bulk entity registrations for tables used by remaining domain libs.
 * Idempotent: skips tables already defined in entity-registry.ts
 */
import fs from "fs";

const registryPath = "src/lib/metadata/entity-registry.ts";
const registry = fs.readFileSync(registryPath, "utf8");

const tables = fs
  .readFileSync("scripts/debt-tables.txt", "utf8")
  .trim()
  .split("\n")
  .map((t) => t.trim())
  .filter(Boolean);

function moduleFor(table) {
  if (table.startsWith("brand_")) return "brand";
  if (table.startsWith("comm_")) return "sd";
  if (table.startsWith("di_")) return "idm";
  if (table.startsWith("dsp_")) return "dispatch";
  if (table.startsWith("fleet_")) return "fleet";
  if (table.startsWith("hc_")) return "sd";
  if (table.startsWith("idm_")) return "iam";
  if (table.startsWith("lbl_")) return "print";
  if (table.startsWith("mes_")) return "mes";
  if (table.startsWith("pkg_")) return "scm";
  if (table.startsWith("ppm_")) return "ppm";
  if (table.startsWith("prt_")) return "print";
  if (table.startsWith("profile_")) return "iam";
  if (table.startsWith("sd_")) return "sd";
  if (table.startsWith("srm_")) return "procurement";
  if (table.startsWith("ta_")) return "ta";
  if (table.startsWith("uw_")) return "iam";
  if (table.startsWith("wid_")) return "iam";
  if (table.startsWith("platform_") || table.startsWith("tenant_"))
    return "settings";
  if (table.startsWith("sales_")) return "sales";
  if (table === "system_settings" || table === "config_change_log")
    return "settings";
  if (table === "media_files") return "settings";
  if (table === "domain_events") return "settings";
  if (table === "user_profiles" || table === "user_sessions") return "iam";
  return "crud";
}

function permFor(mod) {
  const map = {
    brand: "settings.view",
    sd: "sd.view",
    idm: "iam.view",
    dispatch: "dispatch.view",
    fleet: "fleet.view",
    iam: "iam.view",
    print: "print.view",
    mes: "mes.view",
    scm: "inventory.view",
    ppm: "ppm.view",
    procurement: "procurement.view",
    ta: "ta.view",
    settings: "settings.view",
    sales: "sales.view",
    crud: "settings.view",
  };
  return map[mod] || "settings.view";
}

const already = new Set(
  [...registry.matchAll(/defineEntity\(\s*["']([a-z0-9_]+)["']/gi)].map(
    (m) => m[1]
  )
);

const lines = [
  "",
  "// ── Bulk registrations for remaining domain modules (auto) ──",
  "const BULK_STD = { view: \"settings.view\", create: \"settings.manage\", update: \"settings.manage\", delete: \"settings.admin\" } as const;",
  "",
];

let n = 0;
for (const table of tables) {
  if (already.has(table)) continue;
  const mod = moduleFor(table);
  const p = permFor(mod);
  // Module must be valid EntityModule - use only known modules
  const safeMod = [
    "settings",
    "hr",
    "attendance",
    "payroll",
    "finance",
    "inventory",
    "procurement",
    "crm",
    "sales",
    "billing",
    "sd",
    "mes",
    "fleet",
    "ppm",
    "ta",
    "dispatch",
    "print",
    "notifications",
    "crud",
    "wfm",
    "brand",
    "assets",
    "ast",
    "bi",
    "dsp",
    "eal",
    "ec",
    "fraud",
    "hc",
    "iam",
    "intg",
    "pkg",
    "scm",
    "wid",
  ].includes(mod)
    ? mod
    : "crud";
  lines.push(
    `defineEntity("${table}", "${table}", "${safeMod}", { view: "${p}", create: "${p.replace(".view", ".manage")}", update: "${p.replace(".view", ".manage")}", delete: "${p.replace(".view", ".admin")}" }, { softDelete: true, searchable: [] });`
  );
  n++;
}

if (n === 0) {
  console.log("No new entities to register");
  process.exit(0);
}

fs.appendFileSync(registryPath, lines.join("\n") + "\n");
console.log(`Registered ${n} entities`);
