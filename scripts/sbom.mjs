/**
 * Generate a lightweight SBOM (CycloneDX-ish package list) from package-lock.
 * Usage: node scripts/sbom.mjs
 * Output: docs/SBOM.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = join(root, "package-lock.json");
const pkgPath = join(root, "package.json");

if (!existsSync(lockPath)) {
  console.error("package-lock.json missing");
  process.exit(1);
}

const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const components = [];
const packages = lock.packages || {};
for (const [path, meta] of Object.entries(packages)) {
  if (!path || path === "") continue;
  const name = path.replace(/^node_modules\//, "").replace(/\/node_modules\//g, ">");
  if (!meta.version) continue;
  components.push({
    type: "library",
    name: name.split(">").pop(),
    version: meta.version,
    purl: `pkg:npm/${name.split(">").pop()}@${meta.version}`,
    scope: path.includes("node_modules") ? "required" : "optional",
  });
}

const bom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: "application",
      name: pkg.name || "securetrack-erp",
      version: pkg.version || "1.0.0",
    },
    tools: [{ name: "securetrack-sbom", version: "1.0.0" }],
  },
  components: components.slice(0, 5000),
  serialNumber: `urn:uuid:${createHash("sha256")
    .update(JSON.stringify(components.length + pkg.version))
    .digest("hex")
    .slice(0, 32)
    .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5")}`,
};

mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(join(root, "docs", "SBOM.json"), JSON.stringify(bom, null, 2));
console.log(
  JSON.stringify(
    {
      components: bom.components.length,
      wrote: "docs/SBOM.json",
      product: bom.metadata.component,
    },
    null,
    2
  )
);
