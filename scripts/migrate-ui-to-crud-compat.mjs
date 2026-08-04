/**
 * Bulk-swap dashboard/components imports from browser Supabase client
 * to crud-compat for table I/O only.
 *
 * Skips:
 *  - allowlisted self-service / sessions / chat notifications
 *  - pages that use realtime channels, storage, or auth heavily
 */
import fs from "fs";
import path from "path";

const SKIP = new Set([
  "src/app/dashboard/settings/profile/page.tsx",
  "src/app/dashboard/identity/self-service/page.tsx",
  "src/app/dashboard/identity/sessions/page.tsx",
  "src/app/dashboard/chat/notifications/page.tsx",
  "src/app/dashboard/chat/page.tsx", // realtime
  "src/app/dashboard/inventory/grn/page.tsx", // rpc
  "src/app/dashboard/inventory/reservations/page.tsx", // rpc
  "src/app/dashboard/packing/page.tsx", // auth
  "src/app/dashboard/qr-codes/page.tsx", // auth
]);

const FROM = /from\s+["']@\/lib\/supabase\/client["']/g;
const TO = 'from "@/lib/supabase/crud-compat"';

function walk(d, a = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, a);
    else if (/\.(tsx|ts)$/.test(e.name) && !e.name.includes(".test.")) a.push(p);
  }
  return a;
}

const roots = ["src/app/dashboard", "src/components", "src/hooks"];
let n = 0;
const changed = [];
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const f of walk(root)) {
    const rel = f.replace(/\\/g, "/");
    if (SKIP.has(rel)) continue;
    let t = fs.readFileSync(f, "utf8");
    if (!FROM.test(t)) continue;
    FROM.lastIndex = 0;
    // Skip if still needs realtime/auth/storage (belt + suspenders)
    if (/\.channel\s*\(|\.subscribe\s*\(|\.storage\b/.test(t)) {
      console.log("skip special:", rel);
      continue;
    }
    const next = t.replace(FROM, TO);
    if (next !== t) {
      fs.writeFileSync(f, next, "utf8");
      n++;
      changed.push(rel);
    }
  }
}
console.log(`Migrated ${n} files to crud-compat`);
console.log(changed.slice(0, 30).join("\n"));
if (changed.length > 30) console.log(`… +${changed.length - 30} more`);
