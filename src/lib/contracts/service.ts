import { createClient } from "@/lib/supabase/client";
import {
  CONTRACT_DOMAINS,
  type ContractDomain,
  type ContractStats,
} from "./types";

function sb() {
  return createClient();
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function isExpiring(end: unknown, withinDays = 60) {
  if (!end) return false;
  const e = new Date(String(end));
  if (Number.isNaN(e.getTime())) return false;
  const now = new Date();
  const limit = new Date();
  limit.setDate(limit.getDate() + withinDays);
  return e >= now && e <= limit;
}

function isExpired(end: unknown) {
  if (!end) return false;
  const e = new Date(String(end));
  if (Number.isNaN(e.getTime())) return false;
  return e < new Date();
}

function valueOf(row: Record<string, unknown>, domain: ContractDomain): number {
  const meta = CONTRACT_DOMAINS.find((d) => d.key === domain)!;
  return Number(row[meta.valueKey] || 0);
}

/** Normalize party name from joins / denormalized fields */
function partyName(row: Record<string, unknown>, domain: ContractDomain): string {
  if (domain === "sales") return String(row.customer_name || (row.customers as { name?: string })?.name || "—");
  if (domain === "billing") return String((row.customers as { name?: string })?.name || "—");
  if (domain === "crm") return String((row.customers as { name?: string })?.name || "—");
  if (domain === "procurement") {
    const s = row.suppliers as { name?: string; code?: string } | null;
    return s?.name ? `${s.code || ""} ${s.name}`.trim() : "—";
  }
  if (domain === "government") return String(row.agency_name || "—");
  return "—";
}

function displayTitle(row: Record<string, unknown>, domain: ContractDomain): string {
  const meta = CONTRACT_DOMAINS.find((d) => d.key === domain)!;
  return String(row[meta.titleKey] || row.contract_number || "—");
}

export type UnifiedContract = {
  id: string;
  domain: ContractDomain;
  contract_number: string;
  title: string;
  party: string;
  status: string;
  contract_type: string;
  start_date: string | null;
  end_date: string | null;
  value: number;
  currency: string;
  href: string;
  raw: Record<string, unknown>;
};

function toUnified(row: Record<string, unknown>, domain: ContractDomain): UnifiedContract {
  const meta = CONTRACT_DOMAINS.find((d) => d.key === domain)!;
  return {
    id: String(row.id),
    domain,
    contract_number: String(row[meta.numberKey] || row.contract_number || ""),
    title: displayTitle(row, domain),
    party: partyName(row, domain),
    status: String(row.status || "—"),
    contract_type: String(row.contract_type || "—"),
    start_date: row.start_date ? String(row.start_date) : null,
    end_date: row.end_date ? String(row.end_date) : null,
    value: valueOf(row, domain),
    currency: String(row.currency || "UGX"),
    href: `/dashboard/contracts/${domain}/${row.id}`,
    raw: row,
  };
}

export async function listDomainContracts(
  domain: ContractDomain,
  companyId: string,
  opts?: { status?: string; limit?: number }
): Promise<UnifiedContract[]> {
  const limit = opts?.limit ?? 400;
  let q;

  if (domain === "sales") {
    q = sb()
      .from("sales_contracts")
      .select("*, customers(name)")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
  } else if (domain === "billing") {
    q = sb()
      .from("bill_contracts")
      .select("*, customers(name)")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
  } else if (domain === "crm") {
    q = sb()
      .from("crm_contracts")
      .select("*, customers(name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit);
  } else if (domain === "procurement") {
    q = sb()
      .from("procurement_contracts")
      .select("*, suppliers(name, code)")
      .eq("company_id", companyId)
      .order("end_date", { ascending: true })
      .limit(limit);
  } else {
    q = sb()
      .from("fin_government_contracts")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(limit);
  }

  if (opts?.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((r) => toUnified(r as Record<string, unknown>, domain));
}

export async function listAllContracts(companyId: string): Promise<UnifiedContract[]> {
  const results = await Promise.allSettled(
    CONTRACT_DOMAINS.map((d) => listDomainContracts(d.key, companyId, { limit: 200 }))
  );
  const all: UnifiedContract[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  return all.sort((a, b) => String(b.raw.created_at || "").localeCompare(String(a.raw.created_at || "")));
}

export async function getContractStats(companyId: string): Promise<ContractStats> {
  const all = await listAllContracts(companyId);
  const byDomainMap = new Map<ContractDomain, { count: number; value: number }>();
  for (const d of CONTRACT_DOMAINS) byDomainMap.set(d.key, { count: 0, value: 0 });

  let active = 0;
  let draft = 0;
  let expiring = 0;
  let expired = 0;
  let totalValue = 0;

  for (const c of all) {
    const bucket = byDomainMap.get(c.domain)!;
    bucket.count += 1;
    bucket.value += c.value;
    totalValue += c.value;
    const st = c.status.toLowerCase();
    if (st === "active") active += 1;
    if (st === "draft") draft += 1;
    if (isExpired(c.end_date) || st === "expired") expired += 1;
    else if (isExpiring(c.end_date, 60)) expiring += 1;
  }

  return {
    total: all.length,
    active,
    draft,
    expiring,
    expired,
    totalValue,
    byDomain: CONTRACT_DOMAINS.map((d) => ({
      domain: d.key,
      count: byDomainMap.get(d.key)?.count ?? 0,
      value: byDomainMap.get(d.key)?.value ?? 0,
    })),
  };
}

export async function getContractDetail(domain: ContractDomain, id: string) {
  const meta = CONTRACT_DOMAINS.find((d) => d.key === domain);
  if (!meta) throw new Error("Unknown domain");

  let select = "*";
  if (domain === "sales" || domain === "billing" || domain === "crm") {
    select = "*, customers(name, code, email, phone)";
  } else if (domain === "procurement") {
    select = "*, suppliers(name, code, email, phone)";
  }

  const { data, error } = await sb().from(meta.table).select(select).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as Record<string, unknown>;
  const unified = toUnified(row, domain);

  let lines: Array<Record<string, unknown>> = [];
  let milestones: Array<Record<string, unknown>> = [];

  if (domain === "sales") {
    const { data: l } = await sb()
      .from("sales_contract_lines")
      .select("*")
      .eq("company_id", row.company_id)
      .eq("contract_number", row.contract_number)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    lines = (l as Array<Record<string, unknown>>) || [];
  }

  if (domain === "billing") {
    const { data: m } = await sb()
      .from("bill_contract_milestones")
      .select("*")
      .eq("contract_id", id)
      .order("due_date", { ascending: true });
    milestones = (m as Array<Record<string, unknown>>) || [];
  }

  return { contract: unified, raw: row, lines, milestones };
}

export async function listExpiringContracts(companyId: string, withinDays = 90) {
  const all = await listAllContracts(companyId);
  const limit = daysFromNow(withinDays);
  return all
    .filter((c) => {
      if (!c.end_date) return false;
      if (isExpired(c.end_date)) return true;
      return c.end_date <= limit;
    })
    .sort((a, b) => String(a.end_date).localeCompare(String(b.end_date)));
}
