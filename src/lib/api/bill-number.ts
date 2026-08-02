/**
 * Server-side bill document numbering (admin client).
 *
 * Mirrors the browser nextBillNumber helper but runs against the service
 * client so document numbers can never be supplied by the caller.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatBillNumber } from "@/lib/billing";

export async function nextBillNumberServer(
  sb: SupabaseClient,
  companyId: string,
  sequenceCode: string,
  branchCode?: string | null
): Promise<string> {
  const { data: seq } = await sb
    .from("bill_sequences")
    .select("*")
    .eq("company_id", companyId)
    .eq("sequence_code", sequenceCode)
    .maybeSingle();

  if (!seq) {
    const y = new Date().getFullYear();
    return `HDG-${sequenceCode}-${y}-${String(Date.now()).slice(-6)}`;
  }

  const number = formatBillNumber({
    prefix: seq.prefix,
    branch_code: branchCode || seq.branch_code,
    include_year: seq.include_year,
    include_month: seq.include_month,
    pad_length: seq.pad_length,
    next_value: seq.next_value,
    check_digit: seq.check_digit,
    separator: seq.separator,
  });

  await sb
    .from("bill_sequences")
    .update({
      next_value: Number(seq.next_value) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", seq.id);

  return number;
}
