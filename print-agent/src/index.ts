/**
 * Hope SecureTrack — Niimbot Print Agent (Windows / Node 20+)
 *
 * Responsibilities:
 * 1. Heartbeat to Supabase Edge Function `print-agent`
 * 2. Report discovered/configured printers
 * 3. Poll queued print jobs
 * 4. Emit label payloads (outbox files and/or future BLE driver)
 *
 * Niimbot hardware protocol is proprietary; production sites typically:
 * - Pair Niimbot via Windows Bluetooth
 * - Use OUTBOX_MODE + Niimbot desktop/app, OR
 * - Integrate a licensed BLE driver module
 */

import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const AGENT_KEY = process.env.AGENT_KEY || "";
const POLL_MS = Number(process.env.POLL_MS || 5000);
const OUTBOX_MODE = (process.env.OUTBOX_MODE || "true") === "true";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

type LogLevel = "debug" | "info" | "warn" | "error";
const levels: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function log(level: LogLevel, msg: string, extra?: unknown) {
  if (levels[level] < levels[(LOG_LEVEL as LogLevel) || "info"]) return;
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${msg}`;
  if (extra !== undefined) console.log(line, extra);
  else console.log(line);
}

function assertConfig() {
  if (!SUPABASE_URL || !AGENT_KEY) {
    console.error(
      "Missing SUPABASE_URL or AGENT_KEY. Copy .env.example → .env and configure."
    );
    process.exit(1);
  }
}

async function agentFetch(action: string, init?: RequestInit) {
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/print-agent/${action}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-print-agent-key": AGENT_KEY,
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `Agent API ${action} failed: HTTP ${res.status} ${JSON.stringify(json)}`
    );
  }
  return json as Record<string, unknown>;
}

async function heartbeat() {
  // Optionally include static printer list from env PRINTERS_JSON
  let printers: unknown[] = [];
  if (process.env.PRINTERS_JSON) {
    try {
      printers = JSON.parse(process.env.PRINTERS_JSON);
    } catch {
      log("warn", "Invalid PRINTERS_JSON");
    }
  } else {
    // Default declared Niimbot slot for factory floor
    printers = [
      {
        name: process.env.PRINTER_NAME || "Niimbot B21 (Agent)",
        model: process.env.PRINTER_MODEL || "B21",
        transport: "bluetooth",
        address: process.env.PRINTER_BT_ADDRESS || null,
      },
    ];
  }

  return agentFetch("heartbeat", {
    method: "POST",
    body: JSON.stringify({ printers }),
  });
}

async function writeOutboxLabels(
  jobId: string,
  labels: Array<Record<string, unknown>>
) {
  const dir = path.join(ROOT, "outbox", jobId);
  await mkdir(dir, { recursive: true });
  const manifest = {
    jobId,
    createdAt: new Date().toISOString(),
    count: labels.length,
    labels,
  };
  await writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );
  for (const label of labels) {
    const serial = String(label.serial || label.id || "label");
    const safe = serial.replace(/[^\w.-]+/g, "_");
    await writeFile(
      path.join(dir, `${safe}.json`),
      JSON.stringify(label, null, 2),
      "utf8"
    );
    // CSV line for simple importers
    await appendFile(
      path.join(dir, "labels.csv"),
      `${serial},${label.qrData ?? ""}\n`,
      "utf8"
    );
  }
  log("info", `Outbox written: ${dir} (${labels.length} labels)`);
  return dir;
}

async function processJobs() {
  const data = await agentFetch("jobs", { method: "GET" });
  const jobs = (data.jobs as Array<Record<string, unknown>>) || [];
  if (!jobs.length) {
    log("debug", "No queued jobs");
    return;
  }

  for (const job of jobs) {
    const jobId = String(job.id);
    log("info", `Processing job ${jobId}`);

    await agentFetch("jobs", {
      method: "POST",
      body: JSON.stringify({
        jobId,
        status: "printing",
        printedLabels: 0,
      }),
    });

    const meta = (job.metadata || {}) as Record<string, unknown>;
    let labels =
      (meta.labels as Array<Record<string, unknown>>) ||
      (job.labels as Array<Record<string, unknown>>) ||
      [];

    // Prefer metadata.labels (from /api/print/queue)
    if (!labels.length && Array.isArray(job.labels)) {
      labels = job.labels as Array<Record<string, unknown>>;
    }

    let printed = 0;
    let failed = 0;
    let errorMessage: string | undefined;

    try {
      if (OUTBOX_MODE) {
        await writeOutboxLabels(jobId, labels);
        printed = labels.length;
      } else {
        // Placeholder for native Niimbot BLE driver integration
        log(
          "warn",
          "OUTBOX_MODE=false but no native Niimbot driver linked — writing outbox anyway"
        );
        await writeOutboxLabels(jobId, labels);
        printed = labels.length;
      }

      // Report each label success (best-effort)
      for (const label of labels) {
        try {
          await agentFetch("status", {
            method: "POST",
            body: JSON.stringify({
              qrCodeId: label.id,
              status: "success",
              printerId: job.printer_id || null,
            }),
          });
        } catch {
          /* non-fatal */
        }
      }

      await agentFetch("jobs", {
        method: "POST",
        body: JSON.stringify({
          jobId,
          status: "completed",
          printedLabels: printed,
          failedLabels: failed,
        }),
      });
      log("info", `Job ${jobId} completed (${printed} labels)`);
    } catch (e) {
      failed = labels.length;
      errorMessage = e instanceof Error ? e.message : String(e);
      await agentFetch("jobs", {
        method: "POST",
        body: JSON.stringify({
          jobId,
          status: "failed",
          printedLabels: printed,
          failedLabels: failed,
          errorMessage,
        }),
      });
      log("error", `Job ${jobId} failed`, errorMessage);
    }
  }
}

async function main() {
  assertConfig();
  log("info", "Hope SecureTrack Print Agent starting");
  log("info", `Target: ${SUPABASE_URL}`);
  log("info", `Outbox mode: ${OUTBOX_MODE}`);
  log(
    "info",
    `Agent key fingerprint: ${createHash("sha256").update(AGENT_KEY).digest("hex").slice(0, 12)}…`
  );

  // Ensure agent exists note
  log(
    "info",
    "Ensure this AGENT_KEY is hashed & stored in print_agents.agent_key_hash"
  );

  for (;;) {
    try {
      await heartbeat();
      await processJobs();
    } catch (e) {
      log("error", "Loop error", e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
