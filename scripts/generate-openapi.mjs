/**
 * Generate a minimal OpenAPI 3 document from known SecureTrack API routes.
 * Usage: node scripts/generate-openapi.mjs
 * Output: docs/openapi.json
 */
import { writeFileSync, mkdirSync, readdirSync, statSync, existsSync, readFileSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const apiRoot = join(root, "src", "app", "api");

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name === "route.ts") acc.push(p);
  }
  return acc;
}

function routeToPath(file) {
  const rel = relative(join(root, "src", "app"), file).replace(/\\/g, "/");
  return "/" + rel.replace(/\/route\.ts$/, "").replace(/\[([^\]]+)\]/g, "{$1}");
}

const files = walk(apiRoot);
const paths = {};

for (const file of files) {
  const p = routeToPath(file);
  const src = readFileSync(file, "utf8");
  const methods = [];
  for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    if (new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(src)) {
      methods.push(m.toLowerCase());
    }
  }
  if (!methods.length) methods.push("get");

  const isPublic = p.includes("/public/") || p === "/api/health";
  const isWorker = p.includes("/jobs/worker");
  paths[p] = {};
  for (const method of methods) {
    paths[p][method] = {
      summary: `${method.toUpperCase()} ${p}`,
      tags: [p.split("/")[2] || "api", isPublic ? "public" : "authenticated"],
      security: isPublic
        ? []
        : isWorker
          ? [{ WorkerSecret: [] }]
          : [{ SessionCookie: [] }],
      responses: {
        "200": { description: "Success" },
        "401": { description: "Unauthorized" },
        "403": { description: "Forbidden" },
        "429": { description: "Rate limited" },
      },
    };
  }
}

const doc = {
  openapi: "3.0.3",
  info: {
    title: "SecureTrack ERP API",
    version: "1.0.0",
    description:
      "Auto-generated inventory of Next.js route handlers. Auth: session cookie (Supabase) unless public/worker.",
  },
  servers: [{ url: "/", description: "Same origin" }],
  components: {
    securitySchemes: {
      SessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "sb-access-token",
        description: "Supabase auth session cookies",
      },
      WorkerSecret: {
        type: "apiKey",
        in: "header",
        name: "x-job-secret",
        description: "JOB_WORKER_SECRET or CRON_SECRET",
      },
    },
  },
  paths,
};

mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(join(root, "docs", "openapi.json"), JSON.stringify(doc, null, 2));
console.log(
  JSON.stringify(
    {
      routes: files.length,
      paths: Object.keys(paths).length,
      wrote: "docs/openapi.json",
    },
    null,
    2
  )
);
