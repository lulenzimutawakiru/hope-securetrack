/**
 * Load certification harness — multi-endpoint, multi-concurrency report.
 *
 * Usage:
 *   node scripts/load-certify.mjs [baseUrl]
 *
 * Env:
 *   BASE_URL, LOAD_CONCURRENCY (default 20), LOAD_TOTAL (default 100)
 *   LOAD_P95_MS (default 2000), LOAD_ERR_RATE (default 0.05)
 *
 * Writes docs/LOAD_CERTIFICATION_REPORT.json
 */
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const base = (process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const concurrency = Number(process.env.LOAD_CONCURRENCY || 20);
const total = Number(process.env.LOAD_TOTAL || 100);
const p95Limit = Number(process.env.LOAD_P95_MS || 2000);
const errLimit = Number(process.env.LOAD_ERR_RATE || 0.05);

const ENDPOINTS = [
  { path: "/api/health", weight: 5 },
  { path: "/login", weight: 2 },
  { path: "/verify", weight: 1 },
];

function pickEndpoint() {
  const bag = ENDPOINTS.flatMap((e) => Array(e.weight).fill(e.path));
  return bag[Math.floor(Math.random() * bag.length)];
}

async function one() {
  const path = pickEndpoint();
  const t0 = performance.now();
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Accept: "text/html,application/json" },
      redirect: "follow",
    });
    const ms = performance.now() - t0;
    return { ok: res.status < 500, status: res.status, ms, path };
  } catch {
    return { ok: false, status: 0, ms: performance.now() - t0, path };
  }
}

async function runPool() {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < total) {
      const idx = i++;
      results[idx] = await one();
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

const results = await runPool();
const times = results.map((r) => r.ms).sort((a, b) => a - b);
const errors = results.filter((r) => !r.ok).length;
const errRate = errors / results.length;
const byPath = {};
for (const r of results) {
  byPath[r.path] ||= { count: 0, errors: 0, times: [] };
  byPath[r.path].count++;
  if (!r.ok) byPath[r.path].errors++;
  byPath[r.path].times.push(r.ms);
}

const report = {
  generatedAt: new Date().toISOString(),
  product: "SecureTrack ERP",
  base,
  concurrency,
  total: results.length,
  errors,
  errRate: Number(errRate.toFixed(4)),
  avgMs: Math.round(times.reduce((s, n) => s + n, 0) / (times.length || 1)),
  p50Ms: Math.round(percentile(times, 0.5)),
  p95Ms: Math.round(percentile(times, 0.95)),
  p99Ms: Math.round(percentile(times, 0.99)),
  limits: { p95Ms: p95Limit, errRate: errLimit },
  byPath: Object.fromEntries(
    Object.entries(byPath).map(([path, v]) => {
      const t = v.times.sort((a, b) => a - b);
      return [
        path,
        {
          count: v.count,
          errors: v.errors,
          p95Ms: Math.round(percentile(t, 0.95)),
        },
      ];
    })
  ),
  targets: {
    initialPageLoad: "< 2s (manual / Lighthouse)",
    apiTypical: "< 300ms (authenticated; this report is public endpoints)",
    dashboard: "< 2s",
  },
  pass: errRate <= errLimit && percentile(times, 0.95) <= p95Limit,
};

mkdirSync(join(root, "docs"), { recursive: true });
writeFileSync(
  join(root, "docs", "LOAD_CERTIFICATION_REPORT.json"),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (!report.pass) {
  console.error("LOAD CERTIFICATION FAILED");
  process.exit(1);
}
console.log("LOAD CERTIFICATION PASS → docs/LOAD_CERTIFICATION_REPORT.json");
