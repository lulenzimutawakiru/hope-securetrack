import fs from "fs";
import path from "path";

const entities = [
  "locations", "geofences", "devices", "events", "policies", "rotations", "swaps",
  "breaks", "holidays", "corrections", "approvals", "qr", "beacons", "nfc", "rfid",
  "remote", "field-assignments", "violations", "notifications", "settings", "audit",
  "history", "shift-assignments", "shifts",
];

const aliases = {
  calendar: "history",
  my: "history",
  rules: "policies",
  "working-hours": "policies",
  overtime: "policies",
  field: "field-assignments",
  gps: "locations",
  wifi: "locations",
  machines: "devices",
  "device-monitor": "devices",
  "device-sync": "devices",
  payroll: "history",
  compliance: "violations",
};

function pageContent(key) {
  return `"use client";

import { AttEntityPage } from "@/components/attendance/att-entity-page";
import { ATT_ENTITIES } from "@/lib/attendance/entities";

export default function Page() {
  const config = ATT_ENTITIES["${key}"];
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Entity config missing: ${key}</div>;
  }
  return <AttEntityPage config={config} />;
}
`;
}

const root = path.join("src", "app", "dashboard", "attendance");
fs.mkdirSync(root, { recursive: true });
const specialists = new Set(["clock", "live", "ai", "reports"]);
const all = [...entities, ...Object.keys(aliases)];
let n = 0;
for (const slug of all) {
  if (specialists.has(slug)) continue;
  const key = aliases[slug] || slug;
  const dir = path.join(root, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "page.tsx"), pageContent(key), "utf8");
  n++;
}
console.log("Generated", n, "attendance entity pages");
