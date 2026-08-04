/**
 * One-shot: remove browser config_change_log inserts (CRUD engine already audits).
 */
import fs from "fs";

const files = [
  "src/app/dashboard/settings/workflows/page.tsx",
  "src/app/dashboard/settings/modules/page.tsx",
  "src/app/dashboard/settings/branches/page.tsx",
  "src/app/dashboard/settings/integrations/page.tsx",
  "src/app/dashboard/settings/notifications/page.tsx",
  "src/app/dashboard/settings/numbering/page.tsx",
];

const insertRe =
  /\n\s*await supabase\.from\(["']config_change_log["']\)\.insert\(\{[\s\S]*?\}\);/g;

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.warn("skip missing", f);
    continue;
  }
  let t = fs.readFileSync(f, "utf8");
  const before = t;
  t = t.replace(insertRe, "");
  // Remove createClient import if no longer used
  if (!t.includes("createClient(")) {
    t = t.replace(
      /import \{ createClient \} from ["']@\/lib\/supabase\/client["'];\r?\n/,
      ""
    );
  }
  // Remove orphaned `const supabase = createClient();` before crud calls
  t = t.replace(/\n\s*const supabase = createClient\(\);\r?\n(\s*const crud)/g, "\n$1");
  t = t.replace(/\n\s*const supabase = createClient\(\);\r?\n(\s*await crud)/g, "\n$1");
  if (t !== before) {
    fs.writeFileSync(f, t);
    console.log("patched", f);
  } else {
    console.log("unchanged", f);
  }
}
