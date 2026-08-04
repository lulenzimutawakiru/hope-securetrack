import { createClient } from "@/lib/supabase/crud-compat";
import { optimizeRoute, recommendVehicleType } from "./routing";
import { buildDispatchNoteHtml, buildPodHtml, shipmentQrValue } from "./documents";

function sb() {
  return createClient();
}

export async function logDspAudit(input: {
  company_id: string;
  actor_id?: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
}) {
  await sb().from("dsp_audit_log").insert({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    details: input.details,
  });
}

export async function createDispatchRequest(input: {
  company_id: string;
  source_type?: string;
  source_ref?: string;
  customer_name: string;
  delivery_address?: string;
  priority?: string;
  delivery_type?: string;
  delivery_date?: string;
  weight_kg?: number;
  volume_m3?: number;
  required_vehicle_type?: string;
  notes?: string;
  created_by?: string | null;
  lines?: Array<{ product_name: string; sku?: string; quantity?: number; weight_kg?: number; carton_count?: number }>;
}) {
  const { count } = await sb()
    .from("dsp_requests")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);
  const request_number = `DRQ-${String((count ?? 0) + 1).padStart(5, "0")}`;
  const vehicle =
    input.required_vehicle_type ||
    recommendVehicleType(input.weight_kg || 0, input.volume_m3 || 0);

  const { data, error } = await sb()
    .from("dsp_requests")
    .insert({
      company_id: input.company_id,
      request_number,
      source_type: input.source_type || "sales_order",
      source_ref: input.source_ref,
      customer_name: input.customer_name,
      delivery_address: input.delivery_address,
      priority: input.priority || "normal",
      delivery_type: input.delivery_type || "scheduled",
      delivery_date: input.delivery_date,
      weight_kg: input.weight_kg || 0,
      volume_m3: input.volume_m3 || 0,
      required_vehicle_type: vehicle,
      status: "pending",
      notes: input.notes,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.lines?.length) {
    await sb().from("dsp_request_lines").insert(
      input.lines.map((l) => ({
        company_id: input.company_id,
        request_id: data.id,
        product_name: l.product_name,
        sku: l.sku,
        quantity: l.quantity || 1,
        weight_kg: l.weight_kg || 0,
        carton_count: l.carton_count || 0,
      }))
    );
  }

  await notifyDispatch({
    company_id: input.company_id,
    event_type: "dispatch_created",
    recipient: input.customer_name,
    subject: `Dispatch request ${request_number}`,
    body: `Your delivery request ${request_number} has been created.`,
    related_type: "dsp_requests",
    related_id: data.id,
  });

  await logDspAudit({
    company_id: input.company_id,
    actor_id: input.created_by,
    action: "create_request",
    entity_type: "dsp_requests",
    entity_id: data.id,
    details: request_number,
  });

  return data;
}

export async function assignResources(input: {
  company_id: string;
  request_id: string;
  vehicle_id?: string | null;
  driver_id?: string | null;
  actor_id?: string | null;
}) {
  const { data, error } = await sb()
    .from("dsp_requests")
    .update({
      status: "assigned",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.request_id)
    .select("*")
    .single();
  if (error) throw error;

  if (input.vehicle_id) {
    await sb()
      .from("fleet_vehicles")
      .update({ status: "loading" })
      .eq("id", input.vehicle_id);
  }
  if (input.driver_id) {
    await sb()
      .from("dsp_drivers")
      .update({ status: "on_trip", assigned_vehicle_id: input.vehicle_id || null })
      .eq("id", input.driver_id);
  }

  await logDspAudit({
    company_id: input.company_id,
    actor_id: input.actor_id,
    action: "assign",
    entity_type: "dsp_requests",
    entity_id: input.request_id,
    details: `vehicle=${input.vehicle_id || ""} driver=${input.driver_id || ""}`,
  });

  return data;
}

export async function createOptimizedRoute(input: {
  company_id: string;
  name: string;
  request_ids: string[];
  vehicle_id?: string | null;
  driver_id?: string | null;
  strategy?: "fastest" | "shortest" | "fuel" | "balanced";
  created_by?: string | null;
}) {
  const { data: reqs } = await sb()
    .from("dsp_requests")
    .select("*")
    .in("id", input.request_ids);

  const stops = (reqs || []).map((r) => ({
    id: r.id as string,
    name: String(r.customer_name),
    address: r.delivery_address as string | undefined,
    priority: r.priority as string | undefined,
    weight_kg: Number(r.weight_kg || 0),
  }));

  const opt = optimizeRoute(stops, undefined, { strategy: input.strategy });
  const { count } = await sb()
    .from("dsp_routes")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);

  const { data: route, error } = await sb()
    .from("dsp_routes")
    .insert({
      company_id: input.company_id,
      route_number: `RTE-${String((count ?? 0) + 1).padStart(5, "0")}`,
      name: input.name,
      vehicle_id: input.vehicle_id,
      driver_id: input.driver_id,
      planned_date: new Date().toISOString().slice(0, 10),
      status: "optimized",
      total_stops: opt.orderedStops.length,
      total_distance_km: opt.totalDistanceKm,
      estimated_duration_min: opt.estimatedMinutes,
      estimated_fuel_l: opt.estimatedFuelL,
      optimization_score: opt.score,
      route_polyline: opt.orderedStops.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng })),
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  for (let i = 0; i < opt.orderedStops.length; i++) {
    const s = opt.orderedStops[i];
    const req = (reqs || []).find((r) => r.id === s.id);
    await sb().from("dsp_route_stops").insert({
      company_id: input.company_id,
      route_id: route.id,
      request_id: s.id,
      sequence_no: i + 1,
      customer_name: s.name,
      address: s.address || req?.delivery_address,
      lat: s.lat,
      lng: s.lng,
      status: "pending",
    });
    await sb()
      .from("dsp_requests")
      .update({ status: "planned", updated_at: new Date().toISOString() })
      .eq("id", s.id);
  }

  return { route, optimization: opt };
}

export async function startLoading(input: {
  company_id: string;
  request_id?: string | null;
  vehicle_id?: string | null;
  loading_bay?: string;
  expected_items?: number;
  operator_id?: string | null;
}) {
  const { count } = await sb()
    .from("dsp_loading_sessions")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);

  const { data, error } = await sb()
    .from("dsp_loading_sessions")
    .insert({
      company_id: input.company_id,
      session_number: `LOD-${String((count ?? 0) + 1).padStart(5, "0")}`,
      request_id: input.request_id,
      vehicle_id: input.vehicle_id,
      loading_bay: input.loading_bay,
      expected_items: input.expected_items || 0,
      status: "in_progress",
      operator_id: input.operator_id,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.request_id) {
    await sb()
      .from("dsp_requests")
      .update({ status: "loading" })
      .eq("id", input.request_id);
  }
  return data;
}

export async function scanLoadingItem(input: {
  company_id: string;
  session_id: string;
  scan_value: string;
  scan_type?: string;
  product_name?: string;
  expected_values?: string[];
  scanned_by?: string | null;
}) {
  const expected = input.expected_values || [];
  const matched =
    expected.length === 0 ||
    expected.some((v) => v.toUpperCase() === input.scan_value.trim().toUpperCase());

  const { data, error } = await sb()
    .from("dsp_loading_scans")
    .insert({
      company_id: input.company_id,
      session_id: input.session_id,
      scan_value: input.scan_value.trim(),
      scan_type: input.scan_type || "qr",
      product_name: input.product_name,
      matched,
      scanned_by: input.scanned_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  const { data: session } = await sb()
    .from("dsp_loading_sessions")
    .select("*")
    .eq("id", input.session_id)
    .single();

  if (session) {
    await sb()
      .from("dsp_loading_sessions")
      .update({
        scanned_items: Number(session.scanned_items || 0) + 1,
        mismatch_count:
          Number(session.mismatch_count || 0) + (matched ? 0 : 1),
      })
      .eq("id", input.session_id);
  }

  return data;
}

export async function completeLoading(sessionId: string, allowMismatch = false) {
  const { data: session } = await sb()
    .from("dsp_loading_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (!session) throw new Error("Session not found");
  if (!allowMismatch && Number(session.mismatch_count) > 0) {
    throw new Error("Cannot complete loading: scan mismatches detected");
  }
  if (
    Number(session.expected_items) > 0 &&
    Number(session.scanned_items) < Number(session.expected_items) &&
    !allowMismatch
  ) {
    throw new Error("Not all expected items scanned");
  }

  await sb()
    .from("dsp_loading_sessions")
    .update({
      status: "verified",
      sealed: true,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (session.request_id) {
    await sb()
      .from("dsp_requests")
      .update({ status: "ready" })
      .eq("id", session.request_id);
  }
  return session;
}

export async function dispatchShipment(input: {
  company_id: string;
  request_id: string;
  vehicle_reg?: string;
  driver_name?: string;
  driver_phone?: string;
  destination_address?: string;
  actor_id?: string | null;
}) {
  const { data: req } = await sb()
    .from("dsp_requests")
    .select("*")
    .eq("id", input.request_id)
    .single();
  if (!req) throw new Error("Request not found");
  if (req.status === "loading") {
    throw new Error("Complete loading verification before dispatch");
  }

  const { count } = await sb()
    .from("dispatches")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);

  const dispatch_number = `DSP-${String((count ?? 0) + 1).padStart(5, "0")}`;
  const qr = shipmentQrValue(String(req.request_number));

  const { data: dispatch, error } = await sb()
    .from("dispatches")
    .insert({
      company_id: input.company_id,
      dispatch_number,
      customer_name: undefined,
      status: "in_transit",
      vehicle_reg: input.vehicle_reg,
      driver_name: input.driver_name,
      driver_phone: input.driver_phone,
      destination_address: input.destination_address || req.delivery_address,
      waybill_number: `WB-${dispatch_number}`,
      shipment_qr: qr,
      priority: req.priority,
      weight_kg: req.weight_kg,
      volume_m3: req.volume_m3,
      delivery_type: req.delivery_type,
      dispatched_by: input.actor_id,
      notes: `From ${req.request_number}`,
    })
    .select("*")
    .single();

  // Fallback without extended columns if migration not applied
  if (error) {
    const { data: d2, error: e2 } = await sb()
      .from("dispatches")
      .insert({
        company_id: input.company_id,
        dispatch_number,
        status: "in_transit",
        vehicle_reg: input.vehicle_reg,
        driver_name: input.driver_name,
        driver_phone: input.driver_phone,
        destination_address: input.destination_address || req.delivery_address,
        waybill_number: `WB-${dispatch_number}`,
        dispatched_by: input.actor_id,
        notes: `From ${req.request_number} · QR ${qr}`,
      })
      .select("*")
      .single();
    if (e2) throw e2;

    await sb()
      .from("dsp_requests")
      .update({ status: "in_transit", updated_at: new Date().toISOString() })
      .eq("id", input.request_id);

    await notifyDispatch({
      company_id: input.company_id,
      event_type: "out_for_delivery",
      recipient: String(req.customer_name),
      subject: `Out for delivery ${dispatch_number}`,
      body: `Shipment ${dispatch_number} is out for delivery to ${req.delivery_address || "your address"}.`,
      related_type: "dispatches",
      related_id: d2.id,
    });

    return d2;
  }

  await sb()
    .from("dsp_requests")
    .update({ status: "in_transit", updated_at: new Date().toISOString() })
    .eq("id", input.request_id);

  await generateShippingDocument({
    company_id: input.company_id,
    doc_type: "dispatch_note",
    dispatch_id: dispatch.id,
    request_id: input.request_id,
    title: `Dispatch Note ${dispatch_number}`,
    html_body: buildDispatchNoteHtml({
      docNumber: dispatch_number,
      customerName: String(req.customer_name),
      address: String(req.delivery_address || ""),
      vehicle: input.vehicle_reg,
      driver: input.driver_name,
      qrPayload: qr,
    }),
    qr_payload: qr,
    created_by: input.actor_id,
  });

  await notifyDispatch({
    company_id: input.company_id,
    event_type: "out_for_delivery",
    recipient: String(req.customer_name),
    subject: `Out for delivery ${dispatch_number}`,
    body: `Shipment ${dispatch_number} is out for delivery.`,
    related_type: "dispatches",
    related_id: dispatch.id,
  });

  return dispatch;
}

export async function recordPod(input: {
  company_id: string;
  dispatch_id?: string | null;
  request_id?: string | null;
  customer_name?: string;
  receiver_name: string;
  signature_data?: string;
  delivered_qty?: number;
  damaged_qty?: number;
  notes?: string;
  lat?: number;
  lng?: number;
  qr_scanned?: string;
  driver_id?: string | null;
}) {
  const { count } = await sb()
    .from("dsp_pods")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);
  const pod_number = `POD-${String((count ?? 0) + 1).padStart(5, "0")}`;
  const html = buildPodHtml({
    podNumber: pod_number,
    customerName: input.customer_name,
    receiverName: input.receiver_name,
    deliveredQty: input.delivered_qty,
    damagedQty: input.damaged_qty,
    notes: input.notes,
    lat: input.lat,
    lng: input.lng,
    signatureData: input.signature_data || input.receiver_name,
  });

  const { data, error } = await sb()
    .from("dsp_pods")
    .insert({
      company_id: input.company_id,
      pod_number,
      dispatch_id: input.dispatch_id,
      request_id: input.request_id,
      customer_name: input.customer_name,
      receiver_name: input.receiver_name,
      signature_data: input.signature_data || input.receiver_name,
      delivered_qty: input.delivered_qty || 0,
      damaged_qty: input.damaged_qty || 0,
      notes: input.notes,
      lat: input.lat,
      lng: input.lng,
      qr_scanned: input.qr_scanned,
      driver_id: input.driver_id,
      document_html: html,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.request_id) {
    await sb()
      .from("dsp_requests")
      .update({ status: "delivered", updated_at: new Date().toISOString() })
      .eq("id", input.request_id);
  }
  if (input.dispatch_id) {
    await sb()
      .from("dispatches")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
        pod_signed: true,
      })
      .eq("id", input.dispatch_id);
  }

  await notifyDispatch({
    company_id: input.company_id,
    event_type: "delivered",
    recipient: input.customer_name || input.receiver_name,
    subject: `Delivered ${pod_number}`,
    body: `Delivery confirmed. POD ${pod_number} signed by ${input.receiver_name}.`,
    related_type: "dsp_pods",
    related_id: data.id,
  });

  return data;
}

export async function createException(input: {
  company_id: string;
  exception_type: string;
  title: string;
  detail?: string;
  dispatch_id?: string | null;
  request_id?: string | null;
  severity?: string;
  created_by?: string | null;
}) {
  const { count } = await sb()
    .from("dsp_exceptions")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);

  const { data, error } = await sb()
    .from("dsp_exceptions")
    .insert({
      company_id: input.company_id,
      exception_number: `DEX-${String((count ?? 0) + 1).padStart(5, "0")}`,
      exception_type: input.exception_type,
      title: input.title,
      detail: input.detail,
      dispatch_id: input.dispatch_id,
      request_id: input.request_id,
      severity: input.severity || "medium",
      status: "open",
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.request_id) {
    await sb()
      .from("dsp_requests")
      .update({ status: "failed" })
      .eq("id", input.request_id);
  }

  // Service desk bridge
  try {
    await sb().from("support_tickets").insert({
      company_id: input.company_id,
      subject: `[Dispatch] ${input.title}`,
      description: input.detail,
      priority: input.severity === "high" ? "high" : "medium",
      status: "open",
      category: "logistics",
      source: "dispatch",
      created_by: input.created_by,
      metadata: { dsp_exception: data.id },
    });
  } catch {
    /* optional */
  }

  await notifyDispatch({
    company_id: input.company_id,
    event_type: "delivery_failed",
    recipient: "ops@hopedesign.ug",
    subject: input.title,
    body: input.detail || input.title,
    related_type: "dsp_exceptions",
    related_id: data.id,
  });

  return data;
}

export async function createReturn(input: {
  company_id: string;
  return_type?: string;
  customer_name?: string;
  reason?: string;
  dispatch_id?: string | null;
  created_by?: string | null;
}) {
  const { count } = await sb()
    .from("dsp_returns")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);

  const { data, error } = await sb()
    .from("dsp_returns")
    .insert({
      company_id: input.company_id,
      return_number: `RTN-${String((count ?? 0) + 1).padStart(5, "0")}`,
      return_type: input.return_type || "customer",
      customer_name: input.customer_name,
      reason: input.reason,
      dispatch_id: input.dispatch_id,
      status: "authorized",
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function recordGpsPoint(input: {
  company_id: string;
  vehicle_id?: string | null;
  driver_id?: string | null;
  route_id?: string | null;
  dispatch_id?: string | null;
  lat: number;
  lng: number;
  speed_kmh?: number;
}) {
  const { data, error } = await sb()
    .from("dsp_gps_points")
    .insert({
      company_id: input.company_id,
      vehicle_id: input.vehicle_id,
      driver_id: input.driver_id,
      route_id: input.route_id,
      dispatch_id: input.dispatch_id,
      lat: input.lat,
      lng: input.lng,
      speed_kmh: input.speed_kmh || 0,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.vehicle_id) {
    await sb()
      .from("fleet_vehicles")
      .update({
        current_lat: input.lat,
        current_lng: input.lng,
        last_gps_at: new Date().toISOString(),
        status: "in_transit",
      })
      .eq("id", input.vehicle_id);
  }
  return data;
}

export async function generateShippingDocument(input: {
  company_id: string;
  doc_type: string;
  dispatch_id?: string | null;
  request_id?: string | null;
  route_id?: string | null;
  title: string;
  html_body: string;
  qr_payload?: string;
  created_by?: string | null;
}) {
  const { count } = await sb()
    .from("dsp_documents")
    .select("*", { count: "exact", head: true })
    .eq("company_id", input.company_id);

  const { data, error } = await sb()
    .from("dsp_documents")
    .insert({
      company_id: input.company_id,
      doc_type: input.doc_type,
      doc_number: `DOC-${String((count ?? 0) + 1).padStart(5, "0")}`,
      dispatch_id: input.dispatch_id,
      request_id: input.request_id,
      route_id: input.route_id,
      title: input.title,
      html_body: input.html_body,
      qr_payload: input.qr_payload,
      created_by: input.created_by,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function notifyDispatch(input: {
  company_id: string;
  channel?: string;
  event_type: string;
  recipient?: string;
  subject: string;
  body: string;
  related_type?: string;
  related_id?: string;
}) {
  await sb().from("dsp_notifications").insert({
    company_id: input.company_id,
    channel: input.channel || "email",
    event_type: input.event_type,
    recipient: input.recipient,
    subject: input.subject,
    body: input.body,
    status: "queued",
    related_type: input.related_type,
    related_id: input.related_id,
  });
}
