import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const agentKey = req.headers.get("x-print-agent-key");
  if (!agentKey) {
    return new Response(JSON.stringify({ error: "Agent key required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const action = url.pathname.split("/").pop();

  try {
    const { data: agent } = await supabase
      .from("print_agents")
      .select("*")
      .eq("agent_key_hash", await hashKey(agentKey))
      .eq("is_active", true)
      .single();

    if (!agent) {
      return new Response(JSON.stringify({ error: "Invalid agent key" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("print_agents")
      .update({
        status: "online",
        last_heartbeat_at: new Date().toISOString(),
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0],
      })
      .eq("id", agent.id);

    switch (action) {
      case "heartbeat":
        return handleHeartbeat(agent, req.method === "POST" ? await req.json().catch(() => ({})) : {});
      case "jobs":
        return req.method === "GET"
          ? handleGetJobs(agent)
          : handleUpdateJob(agent, await req.json());
      case "status":
        return handleStatusUpdate(agent, await req.json());
      case "printers":
        return req.method === "GET"
          ? handleListPrinters(agent)
          : handleRegisterPrinters(agent, await req.json());
      case "discover":
        return handleRegisterPrinters(agent, await req.json());
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Print agent error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function hashKey(key: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function handleHeartbeat(
  agent: Record<string, unknown>,
  body: Record<string, unknown>
) {
  // Optional: agent reports discovered Niimbot printers on heartbeat
  if (Array.isArray(body.printers)) {
    await handleRegisterPrinters(agent, { printers: body.printers });
  }
  return new Response(
    JSON.stringify({ status: "ok", agentId: agent.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleListPrinters(agent: Record<string, unknown>) {
  const { data } = await supabase
    .from("printers")
    .select("*")
    .eq("company_id", agent.company_id)
    .eq("is_active", true)
    .order("name");
  return new Response(JSON.stringify({ printers: data || [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleRegisterPrinters(
  agent: Record<string, unknown>,
  body: Record<string, unknown>
) {
  const list = (body.printers as Array<Record<string, unknown>>) || [];
  const registered = [];

  for (const p of list) {
    const name = String(p.name || p.deviceName || "Niimbot");
    const deviceId = p.deviceId || p.address || p.bluetoothAddress || null;
    const model = String(p.model || "Niimbot");

    const { data: existing } = await supabase
      .from("printers")
      .select("id")
      .eq("company_id", agent.company_id)
      .eq("name", name)
      .maybeSingle();

    const row = {
      company_id: agent.company_id,
      factory_id: agent.factory_id,
      name,
      model,
      serial_number: p.serialNumber || null,
      connection_type: p.transport || "bluetooth",
      transport: p.transport || "bluetooth",
      bluetooth_address: p.bluetoothAddress || p.address || null,
      device_id: deviceId ? String(deviceId) : null,
      status: "online",
      is_active: true,
      last_seen_at: new Date().toISOString(),
      last_discovered_at: new Date().toISOString(),
      discovery_source: "agent",
      agent_id: String(agent.id),
      firmware_version: p.firmware || null,
      label_width_mm: p.labelWidthMm || 50,
      label_height_mm: p.labelHeightMm || 30,
    };

    if (existing?.id) {
      await supabase.from("printers").update(row).eq("id", existing.id);
      registered.push({ id: existing.id, name, updated: true });
    } else {
      const { data: created } = await supabase
        .from("printers")
        .insert(row)
        .select("id")
        .single();
      registered.push({ id: created?.id, name, created: true });
    }
  }

  return new Response(JSON.stringify({ success: true, registered }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGetJobs(agent: Record<string, unknown>) {
  const { data: jobs } = await supabase
    .from("print_jobs")
    .select(`
      *,
      production_batches(batch_number, product_code, paper_size, gsm),
      qr_codes:qr_codes!inner(*)
    `)
    .eq("company_id", agent.company_id)
    .in("status", ["pending", "queued"])
    .order("priority", { ascending: true })
    .limit(5);

  const enrichedJobs = [];
  for (const job of jobs || []) {
    const { data: qrCodes } = await supabase
      .from("qr_codes")
      .select("*")
      .eq("batch_id", job.batch_id)
      .eq("code_type", job.label_type)
      .in("status", ["generated", "printed"])
      .order("human_serial")
      .limit(job.total_labels);

    enrichedJobs.push({
      ...job,
      labels: (qrCodes || []).map((qr) => ({
        id: qr.id,
        serial: qr.human_serial,
        qrData: JSON.stringify(qr.payload),
        type: qr.code_type,
        status: qr.status,
      })),
    });
  }

  return new Response(
    JSON.stringify({ jobs: enrichedJobs }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleUpdateJob(agent: Record<string, unknown>, body: Record<string, unknown>) {
  const { jobId, status, printedLabels, failedLabels, errorMessage } = body;

  await supabase
    .from("print_jobs")
    .update({
      status,
      printed_labels: printedLabels,
      failed_labels: failedLabels,
      error_message: errorMessage,
      agent_id: agent.id,
      ...(status === "printing" ? { started_at: new Date().toISOString() } : {}),
      ...(status === "completed" || status === "failed"
        ? { completed_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", jobId);

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleStatusUpdate(agent: Record<string, unknown>, body: Record<string, unknown>) {
  const { qrCodeId, printerId, status, attemptNumber, errorMessage, operatorId } = body;

  await supabase.from("print_logs").insert({
    company_id: agent.company_id,
    qr_code_id: qrCodeId,
    printer_id: printerId,
    agent_id: agent.id,
    operator_id: operatorId,
    status,
    attempt_number: attemptNumber || 1,
    error_message: errorMessage,
  });

  if (status === "success" && qrCodeId) {
    await supabase
      .from("qr_codes")
      .update({
        status: "printed",
        print_count: supabase.rpc ? undefined : 1,
        last_printed_at: new Date().toISOString(),
        last_printer_id: printerId,
      })
      .eq("id", qrCodeId);
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
