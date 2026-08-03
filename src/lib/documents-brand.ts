"use client";

/**
 * Client-side company branding loader for printable documents.
 *
 * Uses the browser Supabase client, so every read is RLS-gated to the
 * signed-in user's own company (never a client-supplied tenant/company id for
 * another company). Fails safe to the un-branded document on any error.
 */

import { createClient } from "@/lib/supabase/client";
import {
  resolveCompanyBranding,
  type ResolvedBrand,
} from "@/lib/branding/resolve";
import {
  applyCompanyBrand,
  printDocument,
  downloadDocumentHtml,
  type BusinessDocument,
} from "@/lib/documents";

/** Resolve the active company's brand for the current user. */
export async function loadCompanyBrand(
  companyId: string | null | undefined
): Promise<ResolvedBrand> {
  return resolveCompanyBranding(createClient(), companyId || null);
}

/** Merge the active company's brand into a document (non-throwing). */
export async function applyCompanyBrandToDoc(
  doc: BusinessDocument,
  companyId: string | null | undefined
): Promise<BusinessDocument> {
  try {
    const brand = await loadCompanyBrand(companyId);
    return applyCompanyBrand(doc, brand);
  } catch {
    return doc;
  }
}

/** Print a document branded with the active company identity. */
export async function printDocumentBranded(
  doc: BusinessDocument,
  companyId?: string | null
): Promise<void> {
  printDocument(await applyCompanyBrandToDoc(doc, companyId));
}

/** Download a branded HTML document (open then print / Save as PDF). */
export async function downloadDocumentHtmlBranded(
  doc: BusinessDocument,
  companyId?: string | null,
  filename?: string
): Promise<void> {
  downloadDocumentHtml(await applyCompanyBrandToDoc(doc, companyId), filename);
}
