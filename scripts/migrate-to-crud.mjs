/**
 * Mechanical migration: replace browser Supabase table mutations with domain helpers.
 * Leaves storage.* chains alone. Complex query chains for SELECTs are converted
 * to mustList where possible; remaining .select chains that only read may still
 * use a lightweight read helper.
 *
 * Usage: node scripts/migrate-to-crud.mjs src/lib/foo/service.ts
 */
import fs from "fs";

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error("Usage: node scripts/migrate-to-crud.mjs <file>");
  process.exit(1);
}

let src = fs.readFileSync(file, "utf8");
if (!src.includes("@/lib/supabase/client")) {
  console.log("skip (no browser client):", file);
  process.exit(0);
}

// Remove browser client import
src = src.replace(
  /import\s+\{\s*createClient\s*\}\s+from\s+["']@\/lib\/supabase\/client["'];?\r?\n/g,
  ""
);

// Inject helpers if not present
if (!src.includes("@/lib/crud/domain-helpers")) {
  src =
    `import {\n  crudCount,\n  crudGetOne,\n  mustCreate,\n  mustList,\n  mustUpdate,\n  mustDelete,\n  updateAllMatching,\n} from "@/lib/crud/domain-helpers";\n` +
    src;
}

// Remove sb() / client helpers that only wrap createClient
src = src.replace(
  /function\s+sb\s*\(\s*\)\s*\{\s*return\s+createClient\(\);\s*\}\r?\n/g,
  ""
);
src = src.replace(
  /const\s+sb\s*=\s*\(\)\s*=>\s*createClient\(\);\r?\n/g,
  ""
);

// Replace `const client = sb()` / `const sb = createClient()`
src = src.replace(
  /const\s+(client|supabase|sb)\s*=\s*createClient\(\);?\r?\n/g,
  ""
);
src = src.replace(
  /const\s+(client|supabase|sb)\s*=\s*sb\(\);?\r?\n/g,
  ""
);

// Insert patterns: await X.from("table").insert({...}).select(...).single()
// Simplified: await sb().from("t").insert({...})
src = src.replace(
  /await\s+(?:sb\(\)|client|supabase)\s*\.from\(\s*["']([a-z0-9_]+)["']\s*\)\s*\.insert\(\s*(\{[\s\S]*?\})\s*\)(?:\s*\.select\([^)]*\))?(?:\s*\.single\(\))?/g,
  (m, table, obj) => `await mustCreate("${table}", ${obj})`
);

// Update by id: .update({...}).eq("id", id)
src = src.replace(
  /await\s+(?:sb\(\)|client|supabase)\s*\.from\(\s*["']([a-z0-9_]+)["']\s*\)\s*\.update\(\s*(\{[\s\S]*?\})\s*\)\s*\.eq\(\s*["']id["']\s*,\s*([^)]+)\)(?:\s*\.select\([^)]*\))?(?:\s*\.single\(\))?/g,
  (m, table, obj, id) => `await mustUpdate("${table}", ${id}, ${obj})`
);

// Upsert simplified - convert to mustCreate (may need manual fix)
src = src.replace(
  /await\s+(?:sb\(\)|client|supabase)\s*\.from\(\s*["']([a-z0-9_]+)["']\s*\)\s*\.upsert\(/g,
  `await mustCreate("$1", /* was upsert */ `
);

fs.writeFileSync(file, src);
console.log("migrated (partial mechanical):", file);
