/**
 * Lightweight load smoke — hits public health endpoints in parallel.
 * Usage: node scripts/load-smoke.mjs [baseUrl] [concurrency] [total]
 * Exit 1 if error rate > 5% or p95 > 3000ms.
 */
const base = process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3000";
const concurrency = Number(process.argv[3] || 10);
const total = Number(process.argv[4] || 50);
const path = process.env.LOAD_PATH || "/api/health";

async function one() {
  const t0 = performance.now();
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      headers: { Accept: "application/json" },
    });
    const ms = performance.now() - t0;
    return { ok: res.status < 500, status: res.status, ms };
  } catch {
    return { ok: false, status: 0, ms: performance.now() - t0 };
  }
}

async function pool() {
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

const results = await pool();
const times = results.map((r) => r.ms).sort((a, b) => a - b);
const errors = results.filter((r) => !r.ok).length;
const errRate = errors / results.length;
const p50 = times[Math.floor(times.length * 0.5)] || 0;
const p95 = times[Math.floor(times.length * 0.95)] || 0;
const avg = times.reduce((s, n) => s + n, 0) / (times.length || 1);

const report = {
  base,
  path,
  total: results.length,
  concurrency,
  errors,
  errRate: Number(errRate.toFixed(4)),
  avgMs: Math.round(avg),
  p50Ms: Math.round(p50),
  p95Ms: Math.round(p95),
  pass: errRate <= 0.05 && p95 <= 3000,
};

console.log(JSON.stringify(report, null, 2));
if (!report.pass) {
  console.error("LOAD SMOKE FAILED");
  process.exit(1);
}
console.log("LOAD SMOKE OK");
