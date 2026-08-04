import fs from "fs";
const files = [
  "branding/service.ts",
  "communications/service.ts",
  "digital-identity/service.ts",
  "dispatch/service.ts",
  "fleet/ai.ts",
  "hopechat/service.ts",
  "hopechat/enterprise.ts",
  "idm/service.ts",
  "idm/governance.ts",
  "lbl/ai.ts",
  "mes/service.ts",
  "packaging/service.ts",
  "platform/events.ts",
  "platform/service.ts",
  "ppm/ai.ts",
  "print/service.ts",
  "print/automation.ts",
  "profile/service.ts",
  "sales/ai.ts",
  "service-desk/service.ts",
  "srm/service.ts",
  "system-settings.ts",
  "ta/ai.ts",
  "tenant/service.ts",
  "unified-identity/service.ts",
  "storage/upload.ts",
];
const tables = new Set();
for (const f of files) {
  const p = `src/lib/${f}`;
  if (!fs.existsSync(p)) continue;
  const t = fs.readFileSync(p, "utf8");
  for (const m of t.matchAll(/\.from\(["']([a-z0-9_]+)["']\)/gi)) {
    tables.add(m[1]);
  }
}
console.log([...tables].sort().join("\n"));
console.log("TOTAL", tables.size);
