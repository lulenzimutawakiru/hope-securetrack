import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePortalUserByToken } from "@/lib/security/tokens";
import {
  ingressRateLimit,
  isPlausibleSecretToken,
} from "@/lib/security/public-ingress";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public customer billing portal API (service role).
 * Tokens are verified via SHA-256 hash (with plaintext migration fallback).
 */
export async function GET(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("portal-get", 60, 60_000, req);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rl.response.headers }
      );
    }

    const token = (req.nextUrl.searchParams.get("token") || "").trim();
    if (!isPlausibleSecretToken(token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const sb = createAdminClient();
    const user = await resolvePortalUserByToken(sb, token);

    if (!user) {
      return NextResponse.json({ error: "Portal access denied" }, { status: 401 });
    }

    // Never return secrets
    const {
      access_token: _t,
      access_token_hash: _h,
      ...safeUser
    } = user;

    await sb
      .from("bill_portal_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id as string);

    const customerId = user.customer_id as string;
    const companyId = user.company_id as string;

    const { data: inv } = await sb
      .from("invoices")
      .select(
        "id,invoice_number,invoice_type,status,invoice_date,due_date,currency,subtotal,tax_amount,total_amount,amount_paid,bank_details,terms_conditions,qr_public_id"
      )
      .eq("company_id", companyId)
      .eq("customer_id", customerId)
      .not("status", "eq", "void")
      .order("invoice_date", { ascending: false })
      .limit(100);

    const { data: pays } = await sb
      .from("invoice_payments")
      .select(
        "id,amount,payment_date,method,reference,invoices!inner(invoice_number,customer_id,company_id)"
      )
      .eq("invoices.customer_id", customerId)
      .eq("invoices.company_id", companyId)
      .order("payment_date", { ascending: false })
      .limit(50);

    let contracts: unknown[] = [];
    try {
      const { data: ctr } = await sb
        .from("bill_contracts")
        .select("id,contract_number,title,status,start_date,end_date")
        .eq("company_id", companyId)
        .eq("customer_id", customerId)
        .limit(50);
      contracts = ctr || [];
    } catch {
      contracts = [];
    }

    return NextResponse.json({
      ok: true,
      portal_user: safeUser,
      invoices: inv || [],
      payments: pays || [],
      contracts,
      payment_sandbox: process.env.PAYMENT_SANDBOX === "true",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Portal failed" },
      { status: 500 }
    );
  }
}

const paySchema = z.object({
  token: z.string().min(16).max(200),
  invoice_id: z.string().uuid(),
  gateway_code: z.string().min(2).max(20).default("MTN"),
  /** Only honored when PAYMENT_SANDBOX=true */
  complete_sandbox: z.boolean().optional(),
});

const disputeSchema = z.object({
  token: z.string().min(16).max(200),
  subject: z.string().min(3).max(200),
  description: z.string().max(4000).optional(),
  invoice_id: z.string().uuid().optional().nullable(),
});

/**
 * POST actions: create_intent | dispute
 * Never completes real payments without sandbox.
 */
export async function POST(req: NextRequest) {
  try {
    const rl = await ingressRateLimit("portal-post", 30, 60_000, req);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rl.response.headers }
      );
    }

    const body = await req.json();
    const action = String(body.action || "create_intent");

    const sb = createAdminClient();

    if (action === "dispute") {
      const parsed = disputeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed" }, { status: 400 });
      }
      const user = await resolvePortalUserByToken(sb, parsed.data.token);
      if (!user) {
        return NextResponse.json({ error: "Portal access denied" }, { status: 401 });
      }

      const num = `DSP-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await sb.from("bill_portal_disputes").insert({
        company_id: user.company_id,
        customer_id: user.customer_id,
        invoice_id: parsed.data.invoice_id || null,
        dispute_number: num,
        subject: parsed.data.subject,
        description: parsed.data.description || "",
        status: "open",
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, dispute_number: num });
    }

    const parsed = paySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const user = await resolvePortalUserByToken(sb, parsed.data.token);
    if (!user) {
      return NextResponse.json({ error: "Portal access denied" }, { status: 401 });
    }

    const { data: inv } = await sb
      .from("invoices")
      .select("id,company_id,customer_id,total_amount,amount_paid,currency,status")
      .eq("id", parsed.data.invoice_id)
      .eq("company_id", user.company_id as string)
      .eq("customer_id", user.customer_id as string)
      .maybeSingle();

    if (!inv) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const balance = Number(inv.total_amount) - Number(inv.amount_paid || 0);
    if (balance <= 0) {
      return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });
    }

    const { createPaymentIntent, completePaymentIntent } = await import(
      "@/lib/billing/gateway"
    );
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";

    const intent = await createPaymentIntent(sb, {
      company_id: String(user.company_id),
      invoice_id: String(inv.id),
      customer_id: String(user.customer_id),
      amount: balance,
      currency: String(inv.currency || "UGX"),
      gateway_code: parsed.data.gateway_code,
      base_url: origin,
    });

    let completed = false;
    if (parsed.data.complete_sandbox && process.env.PAYMENT_SANDBOX === "true") {
      if (
        process.env.NODE_ENV === "production" &&
        process.env.ALLOW_PRODUCTION_SANDBOX !== "true"
      ) {
        return NextResponse.json(
          {
            error:
              "Sandbox settlement is disabled in production. Use BILLING_WEBHOOK_SECRET webhook.",
          },
          { status: 403 }
        );
      }
      await completePaymentIntent(sb, String(intent.external_ref), {
        allowSandbox: true,
        serviceTrusted: true,
      });
      completed = true;
    }

    return NextResponse.json({
      ok: true,
      intent: {
        intent_number: intent.intent_number,
        external_ref: intent.external_ref,
        payment_link: intent.payment_link,
        status: completed ? "succeeded" : intent.status,
        amount: intent.amount,
        currency: intent.currency,
      },
      completed_sandbox: completed,
      message: completed
        ? "Sandbox payment completed (PAYMENT_SANDBOX=true only)"
        : "Payment intent created. Complete via gateway / webhook — not auto-settled in production.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Portal action failed" },
      { status: 500 }
    );
  }
}
