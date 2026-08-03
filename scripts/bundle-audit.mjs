#!/usr/bin/env node
/**
 * Bundle audit for the SecureTrack ERP frontend.
 *
 * Reads the `.next` build output (Turbopack / Next.js 16) and reports:
 *   - total client JavaScript payload (all static chunks)
 *   - largest client chunks, with how many routes reference each
 *   - per-route client chunk weight (via RSC client-reference manifests),
 *     split into total bytes vs route-unique bytes
 *   - largest server route bundles
 *   - warning thresholds (oversized chunks, heavy routes)
 *
 * Usage:
 *   node scripts/bundle-audit.mjs          # table report
 *   node scripts/bundle-audit.mjs --json   # machine-readable JSON
 *   node scripts/bundle-audit.mjs --strict # exit 1 when warnings fire (CI)
 *
 * Thresholds are informational defaults; tune via env vars:
 *   CHUNK_WARN_KB (default 500)  ROUTE_WARN_KB (default 1500)
 */

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEXT_DIR = path.join(ROOT, ".next");
const CHUNKS_DIR = path.join(NEXT_DIR, "static", "chunks");
const SERVER_APP_DIR = path.join(NEXT_DIR, "server", "app");

const CHUNK_WARN_KB = Number(process.env.CHUNK_WARN_KB || 500);
const ROUTE_WARN_KB = Number(process.env.ROUTE_WARN_KB || 1500);
const STRICT = process.argv.includes("--strict");
const JSON_OUT = process.argv.includes("--json");

const kb = (bytes) => (bytes / 1024).toFixed(0);

async function walk(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function main() {
  let chunkSizes = new Map();
  try {
    const files = await walk(CHUNKS_DIR);
    for (const f of files) {
      if (!f.endsWith(".js")) continue;
      const s = await stat(f);
      chunkSizes.set(path.basename(f), s.size);
    }
  } catch {
    console.error("ERROR: could not read .next/static/chunks - run a build first.");
    process.exit(2);
  }

  const totalClientBytes = [...chunkSizes.values()].reduce((a, b) => a + b, 0);

  // Route -> chunk references from RSC client-reference manifests.
  const routeRefs = new Map(); // route -> Set<chunkBasename>
  const routeChunkUse = new Map(); // chunkBasename -> Set<route>
  const manifests = (await walk(SERVER_APP_DIR)).filter((f) =>
    f.endsWith("_client-reference-manifest.js")
  );
  for (const m of manifests) {
    let text = "";
    try {
      text = await readFile(m, "utf-8");
    } catch {
      continue;
    }
    const m2 = text.match(/__RSC_MANIFEST\["([^"]+)"\]/);
    if (!m2) continue;
    const route = m2[1];
    const set = new Set();
    for (const match of text.matchAll(/"chunks":\[[^\]]*\]/g)) {
      for (const cm of match[0].matchAll(/"([^"]+\.js)"/g)) {
        const base = path.basename(cm[1]);
        set.add(base);
      }
    }
    routeRefs.set(route, set);
    for (const base of set) {
      if (!routeChunkUse.has(base)) routeChunkUse.set(base, new Set());
      routeChunkUse.get(base).add(route);
    }
  }

  // Per-route totals (shared chunks count on every route that loads them).
  const routeStats = [];
  for (const [route, chunks] of routeRefs) {
    let bytes = 0;
    let known = 0;
    for (const c of chunks) {
      const size = chunkSizes.get(c);
      if (size !== undefined) {
        bytes += size;
        known += 1;
      }
    }
    routeStats.push({
      route,
      chunks: chunks.size,
      bytes,
      unknownChunks: chunks.size - known,
    });
  }
  routeStats.sort((a, b) => b.bytes - a.bytes);

  // Chunk usage (how many routes reference each chunk).
  const chunkStats = [];
  for (const [base, size] of chunkSizes) {
    chunkStats.push({ chunk: base, bytes: size, routes: routeChunkUse.get(base)?.size ?? 0 });
  }
  chunkStats.sort((a, b) => b.bytes - a.bytes);

  // Server route bundles.
  const serverBundles = [];
  for (const f of await walk(SERVER_APP_DIR)) {
    if (!/page(_\d+)?\.js$/.test(f)) continue;
    const s = await stat(f);
    serverBundles.push({ file: path.relative(NEXT_DIR, f), bytes: s.size });
  }
  serverBundles.sort((a, b) => b.bytes - a.bytes);

  const bigChunks = chunkStats.filter((c) => c.bytes > CHUNK_WARN_KB * 1024);
  const heavyRoutes = routeStats.filter((r) => r.bytes > ROUTE_WARN_KB * 1024);

  if (JSON_OUT) {
    const report = {
      totalClientKb: Math.round(totalClientBytes / 1024),
      clientChunkFiles: chunkSizes.size,
      routes: routeRefs.size,
      largestChunks: chunkStats.slice(0, 25).map((c) => ({ ...c, kb: Number(kb(c.bytes)) })),
      heaviestRoutes: routeStats.slice(0, 25).map((r) => ({ ...r, kb: Number(kb(r.bytes)) })),
      largestServerBundles: serverBundles.slice(0, 15).map((s) => ({ ...s, kb: Number(kb(s.bytes)) })),
      warnings: {
        chunksOver: bigChunks.map((c) => ({ ...c, kb: Number(kb(c.bytes)) })),
        routesOver: heavyRoutes.map((r) => ({ ...r, kb: Number(kb(r.bytes)) })),
      },
    };
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("SecureTrack ERP - bundle audit");
    console.log("==============================");
    console.log(`Client chunks: ${chunkSizes.size.toLocaleString()} files, ${kb(totalClientBytes)} KB total`);
    console.log(`Routes analyzed: ${routeRefs.size}`);
    console.log("");
    console.log("Largest client chunks:");
    for (const c of chunkStats.slice(0, 20)) {
      const flag = c.bytes > CHUNK_WARN_KB * 1024 ? "  <-- OVER" : "";
      console.log(`  ${kb(c.bytes).padStart(6)} KB  ${c.routes.toString().padStart(4)} routes  ${c.chunk}${flag}`);
    }
    console.log("");
    console.log("Heaviest routes (client payload incl. shared chunks):");
    for (const r of routeStats.slice(0, 20)) {
      const flag = r.bytes > ROUTE_WARN_KB * 1024 ? "  <-- OVER" : "";
      console.log(`  ${kb(r.bytes).padStart(7)} KB  ${r.chunks.toString().padStart(4)} chunks  ${r.route}${flag}`);
    }
    console.log("");
    console.log("Largest server route bundles:");
    for (const s of serverBundles.slice(0, 12)) {
      console.log(`  ${kb(s.bytes).padStart(6)} KB  ${s.file}`);
    }
    console.log("");
    console.log(`Warnings: ${bigChunks.length} chunks > ${CHUNK_WARN_KB} KB, ${heavyRoutes.length} routes > ${ROUTE_WARN_KB} KB`);
  }

  if (STRICT && (bigChunks.length > 0 || heavyRoutes.length > 0)) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("bundle-audit failed:", e);
  process.exit(2);
});
