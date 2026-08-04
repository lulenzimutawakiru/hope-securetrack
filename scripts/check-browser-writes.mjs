/**
 * Fail when dashboard/client code mutates Supabase via the browser client.
 * Allowlist is for gradual migration of self-service profile paths.
 *
 * Usage: node scripts/check-browser-writes.mjs [--strict]
 */
import fs from "fs";
import path from "path";

const root = process.cwd();
const strict =
  process.argv.includes("--strict") ||
  process.env.BROWSER_WRITE_STRICT === "true" ||
  process.env.CI === "true";

/** Relative paths allowed to keep limited self-service browser writes (RLS-only). */
const ALLOWLIST = new Set([
  // Self-service profile / MFA flags (own row only via RLS)
  "src/app/dashboard/settings/profile/page.tsx",
  "src/app/dashboard/identity/self-service/page.tsx",
  "src/app/dashboard/identity/sessions/page.tsx",
  // Notification mark-read (own notifications)
  "src/app/dashboard/chat/notifications/page.tsx",
]);

const WRITE_RE =
  /\.(insert|update|delete|upsert)\s*\(/g;
const CLIENT_IMPORT_RE =
  /from\s+["']@\/lib\/supabase\/client["']|createClient\s*\(\s*\)/;

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts|jsx|js)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

const scanRoots = [
  path.join(root, "src/app/dashboard"),
  path.join(root, "src/components"),
  path.join(root, "src/hooks"),
];

const violations = [];

for (const scanRoot of scanRoots) {
  for (const file of walk(scanRoot)) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (ALLOWLIST.has(rel)) continue;
    const text = fs.readFileSync(file, "utf8");
    if (!CLIENT_IMPORT_RE.test(text) && !text.includes("supabase/client")) {
      continue;
    }
    // Reset lastIndex
    WRITE_RE.lastIndex = 0;
    let m;
    const hits = [];
    while ((m = WRITE_RE.exec(text))) {
      // Ignore Set/Map delete and local state patterns without from(
      const start = Math.max(0, m.index - 80);
      const ctx = text.slice(start, m.index + 40);
      if (/\.from\s*\(/.test(ctx) || /supabase|createClient|sb\s*\./.test(ctx)) {
        hits.push(m[1]);
      }
    }
    if (hits.length) {
      violations.push({ file: rel, methods: [...new Set(hits)] });
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  violationCount: violations.length,
  violations: violations.slice(0, 100),
  allowlist: [...ALLOWLIST],
};

fs.writeFileSync(
  path.join(root, "docs", "BROWSER_WRITE_AUDIT.json"),
  JSON.stringify(report, null, 2)
);

console.log("=== Browser Supabase write audit ===");
console.log(` Violations: ${violations.length}`);
for (const v of violations.slice(0, 25)) {
  console.log(`  - ${v.file}: ${v.methods.join(", ")}`);
}
if (violations.length > 25) {
  console.log(`  … and ${violations.length - 25} more (see docs/BROWSER_WRITE_AUDIT.json)`);
}

if (strict && violations.length > 0) {
  console.error(
    "FAIL: Browser Supabase writes found outside allowlist. Route mutations through /api/v2/crud or domain APIs."
  );
  process.exit(2);
}

if (violations.length > 0) {
  console.warn("WARN: browser writes remain (non-strict mode)");
}
process.exit(0);
