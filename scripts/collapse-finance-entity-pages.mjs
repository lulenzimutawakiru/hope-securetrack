/**
 * Remove thin FinEntityPage wrappers under dashboard/finance.
 * Dynamic route finance/[entity] serves them instead.
 * Keeps specialist (custom) pages.
 */
import fs from "fs";
import path from "path";

const root = path.join("src", "app", "dashboard", "finance");
const specialist = new Set([
  "ai",
  "ap",
  "approvals",
  "ar",
  "assets",
  "bank",
  "budgets",
  "cash",
  "cfo",
  "coa",
  "cost-centres",
  "costing",
  "engine",
  "journals",
  "mobile",
  "periods",
  "reports",
  "tax",
  "treasury",
  "[entity]",
]);

let removed = 0;
for (const name of fs.readdirSync(root, { withFileTypes: true })) {
  if (!name.isDirectory()) continue;
  if (specialist.has(name.name)) continue;
  const pagePath = path.join(root, name.name, "page.tsx");
  if (!fs.existsSync(pagePath)) continue;
  const content = fs.readFileSync(pagePath, "utf8");
  if (!content.includes("FinEntityPage")) {
    console.log("skip custom:", name.name);
    continue;
  }
  fs.rmSync(path.join(root, name.name), { recursive: true, force: true });
  removed += 1;
  console.log("removed", name.name);
}
console.log("done, removed", removed);
