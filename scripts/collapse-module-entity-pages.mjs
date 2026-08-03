/**
 * Remove thin *EntityPage wrappers under a dashboard module.
 * Dynamic [entity] routes serve them instead.
 *
 * Usage: node scripts/collapse-module-entity-pages.mjs payroll fleet sales attendance
 */
import fs from "fs";
import path from "path";

const modules = process.argv.slice(2);
if (!modules.length) {
  console.error(
    "Usage: node scripts/collapse-module-entity-pages.mjs <module> [...]"
  );
  process.exit(1);
}

/** Markers that identify generated/thin EntityPage wrappers */
const THIN_MARKERS = [
  "FinEntityPage",
  "PayEntityPage",
  "FleetEntityPage",
  "SalesEntityPage",
  "AttEntityPage",
  "TaEntityPage",
  "PpmEntityPage",
  "LblEntityPage",
  "MesEntityPage",
];

let total = 0;
for (const mod of modules) {
  const root = path.join("src", "app", "dashboard", mod);
  if (!fs.existsSync(root)) {
    console.log("skip missing", mod);
    continue;
  }
  let removed = 0;
  for (const name of fs.readdirSync(root, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    if (name.name === "[entity]" || name.name.startsWith("[")) continue;
    const pagePath = path.join(root, name.name, "page.tsx");
    if (!fs.existsSync(pagePath)) continue;
    // Only collapse leaf entity folders (no nested routes beyond page.tsx)
    const dir = path.join(root, name.name);
    const children = fs.readdirSync(dir);
    if (children.some((c) => c !== "page.tsx" && c !== "loading.tsx" && c !== "error.tsx")) {
      // may be a nest — only remove if sole content is thin page
      const hasSubdir = children.some((c) =>
        fs.statSync(path.join(dir, c)).isDirectory()
      );
      if (hasSubdir) {
        console.log("skip nested", mod, name.name);
        continue;
      }
    }
    const content = fs.readFileSync(pagePath, "utf8");
    if (!THIN_MARKERS.some((m) => content.includes(m))) {
      console.log("skip custom", mod, name.name);
      continue;
    }
    fs.rmSync(dir, { recursive: true, force: true });
    removed += 1;
    total += 1;
  }
  console.log(mod, "removed", removed);
}
console.log("total removed", total);
