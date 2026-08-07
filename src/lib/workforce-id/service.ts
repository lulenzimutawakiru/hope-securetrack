/**
 * Workforce Identity service helpers — create identity + credential + access.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatIdentityNumber,
  formatCredentialNumber,
  generateSecuritySeal,
  generateAntiCopyNonce,
  generateCardSerial,
  generateRfidUid,
  generateNfcUid,
  generateJobNumber,
  suggestSequenceCode,
  suggestAccessProfile,
} from "./id-engine";
import {
  buildIdentityQrPayload,
  createQrPublicId,
  encodeIdentityQrToken,
} from "./qr-token";

export async function nextIdentityNumber(
  supabase: SupabaseClient,
  companyId: string,
  sequenceCode: string
): Promise<string> {
  const { data: seq } = await supabase
    .from("wid_id_sequences")
    .select("*")
    .eq("company_id", companyId)
    .eq("sequence_code", sequenceCode)
    .maybeSingle();

  if (!seq) {
    const year = new Date().getFullYear();
    const fallback = `HDG-${sequenceCode}-${year}-${String(Date.now()).slice(-6)}`;
    return fallback;
  }

  const number = formatIdentityNumber({
    prefix: seq.prefix,
    category_code: seq.category_code,
    include_year: seq.include_year,
    include_location: seq.include_location,
    location_code: seq.location_code,
    pad_length: seq.pad_length,
    next_value: seq.next_value,
    check_digit: seq.check_digit,
    separator: seq.separator,
  });

  await supabase
    .from("wid_id_sequences")
    .update({
      next_value: Number(seq.next_value) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", seq.id);

  return number;
}

export type CreateIdentityInput = {
  company_id: string;
  employee_id?: string | null;
  identity_type: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  department?: string;
  job_title?: string;
  employment_type?: string;
  operational_role?: string;
  branch_name?: string;
  location_name?: string;
  blood_group?: string;
  emergency_contact?: string;
  hire_date?: string;
  expiry_date?: string;
  security_clearance?: string;
  manager_name?: string;
  notes?: string;
  photo_url?: string;
  created_by?: string | null;
};

export async function createIdentityWithNumber(
  supabase: SupabaseClient,
  input: CreateIdentityInput
) {
  const seqCode = suggestSequenceCode(input.identity_type, input.department);
  const identity_number = await nextIdentityNumber(
    supabase,
    input.company_id,
    seqCode
  );

  const row = {
    company_id: input.company_id,
    employee_id: input.employee_id || null,
    identity_number,
    identity_type: input.identity_type,
    full_name: input.full_name,
    first_name: input.first_name || input.full_name.split(" ")[0] || null,
    last_name:
      input.last_name ||
      input.full_name.split(" ").slice(1).join(" ") ||
      null,
    email: input.email || null,
    phone: input.phone || null,
    department: input.department || null,
    job_title: input.job_title || null,
    employment_type: input.employment_type || null,
    operational_role: input.operational_role || null,
    branch_name: input.branch_name || null,
    location_name: input.location_name || null,
    blood_group: input.blood_group || null,
    emergency_contact: input.emergency_contact || null,
    hire_date: input.hire_date || null,
    expiry_date: input.expiry_date || null,
    security_clearance: input.security_clearance || "standard",
    manager_name: input.manager_name || null,
    notes: input.notes || null,
    photo_url: input.photo_url || null,
    status: "verified",
    username: input.email?.split("@")[0] || null,
    erp_account: identity_number,
    created_by: input.created_by || null,
  };

  const { data, error } = await supabase
    .from("wid_identities")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type IssueCredentialInput = {
  company_id: string;
  identity_id: string;
  template_id?: string | null;
  brand_id?: string | null;
  credential_type?: string;
  expiry_date?: string | null;
  access_profile_code?: string | null;
  with_rfid?: boolean;
  with_nfc?: boolean;
  created_by?: string | null;
  auto_queue_print?: boolean;
};

export async function issueCredential(
  supabase: SupabaseClient,
  input: IssueCredentialInput
) {
  const { data: identity, error: iErr } = await supabase
    .from("wid_identities")
    .select("*")
    .eq("id", input.identity_id)
    .single();
  if (iErr || !identity) throw iErr || new Error("Identity not found");

  const { count } = await supabase
    .from("wid_credentials")
    .select("*", { count: "exact", head: true })
    .eq("identity_id", input.identity_id);

  const credential_number = formatCredentialNumber(
    identity.identity_number,
    (count ?? 0) + 1
  );

  const publicId = createQrPublicId();
  const nonce = generateAntiCopyNonce();
  const payload = buildIdentityQrPayload({
    publicId,
    identityNumber: identity.identity_number,
    credentialNumber: credential_number,
    expiryDate: input.expiry_date || identity.expiry_date,
    nonce,
  });
  const qr_token = encodeIdentityQrToken(payload);
  const profile =
    input.access_profile_code ||
    suggestAccessProfile(identity.identity_type, identity.department);

  const credential = {
    company_id: input.company_id,
    identity_id: input.identity_id,
    template_id: input.template_id || null,
    brand_id: input.brand_id || null,
    credential_number,
    card_serial: generateCardSerial(
      input.credential_type === "rfid" ? "RFID" : "PVC"
    ),
    credential_type: input.credential_type || "pvc",
    status: "approved",
    issue_date: new Date().toISOString().slice(0, 10),
    expiry_date: input.expiry_date || identity.expiry_date || null,
    qr_token,
    qr_public_id: publicId,
    barcode_value: credential_number,
    rfid_uid: input.with_rfid ? generateRfidUid() : null,
    nfc_uid: input.with_nfc ? generateNfcUid() : null,
    security_seal: generateSecuritySeal(),
    anti_copy_nonce: nonce,
    access_profile_code: profile,
    snapshot_json: {
      full_name: identity.full_name,
      identity_number: identity.identity_number,
      department: identity.department,
      job_title: identity.job_title,
    },
    hologram_zone: true,
    created_by: input.created_by || null,
  };

  const { data: cred, error } = await supabase
    .from("wid_credentials")
    .insert(credential)
    .select()
    .single();
  if (error) throw error;

  // Auto access assignment from profile
  const { data: prof } = await supabase
    .from("wid_access_profiles")
    .select("*")
    .eq("company_id", input.company_id)
    .eq("profile_code", profile)
    .maybeSingle();

  if (prof) {
    await supabase.from("wid_access_assignments").insert({
      company_id: input.company_id,
      identity_id: input.identity_id,
      credential_id: cred.id,
      profile_id: prof.id,
      grant_type: "profile",
      status: "active",
      reason: "Auto-provisioned on credential issue",
      assigned_by: input.created_by || null,
    });
  }

  if (input.auto_queue_print) {
    const { count: pcount } = await supabase
      .from("wid_print_jobs")
      .select("*", { count: "exact", head: true })
      .eq("company_id", input.company_id);
    await supabase.from("wid_print_jobs").insert({
      company_id: input.company_id,
      credential_id: cred.id,
      job_number: generateJobNumber((pcount ?? 0) + 1),
      printer_brand: "browser",
      printer_name: "Browser Print",
      status: "pending",
      requested_by: input.created_by || null,
      sides: "both",
      copies: 1,
    });
  }

  await supabase
    .from("wid_identities")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", input.identity_id);

  return cred;
}

export async function activateCredential(
  supabase: SupabaseClient,
  credentialId: string
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("wid_credentials")
    .update({
      status: "active",
      activation_date: now,
      issued_at: now,
      updated_at: now,
    })
    .eq("id", credentialId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function suspendCredential(
  supabase: SupabaseClient,
  credentialId: string,
  reason?: string
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("wid_credentials")
    .update({
      status: "suspended",
      suspended_at: now,
      notes: reason || null,
      updated_at: now,
    })
    .eq("id", credentialId)
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from("wid_access_assignments")
    .update({ status: "suspended", updated_at: now })
    .eq("credential_id", credentialId)
    .eq("status", "active");

  return data;
}

export async function terminateIdentity(
  supabase: SupabaseClient,
  identityId: string
) {
  const now = new Date().toISOString();
  await supabase
    .from("wid_identities")
    .update({ status: "terminated", updated_at: now })
    .eq("id", identityId);

  await supabase
    .from("wid_credentials")
    .update({ status: "destroyed", destroyed_at: now, updated_at: now })
    .eq("identity_id", identityId)
    .not("status", "in", '("destroyed","archived")');

  await supabase
    .from("wid_access_assignments")
    .update({ status: "revoked", updated_at: now })
    .eq("identity_id", identityId)
    .eq("status", "active");

  await supabase
    .from("wid_mobile_badges")
    .update({ status: "revoked", revoked_at: now, updated_at: now })
    .eq("identity_id", identityId)
    .eq("status", "active");
}

export async function verifyByPublicId(
  supabase: SupabaseClient,
  publicId: string,
  meta?: {
    company_id?: string;
    scanner_context?: string;
    scanned_by?: string;
    location_name?: string;
  }
) {
  const { data: cred } = await supabase
    .from("wid_credentials")
    .select("*, wid_identities(*)")
    .eq("qr_public_id", publicId)
    .maybeSingle();

  let result = "not_found";
  if (!cred) {
    result = "not_found";
  } else if (["suspended", "lost", "stolen", "destroyed", "returned"].includes(cred.status)) {
    result = cred.status === "suspended" ? "suspended" : "revoked";
  } else if (cred.expiry_date && new Date(cred.expiry_date) < new Date()) {
    result = "expired";
  } else if (["active", "issued", "printed"].includes(cred.status)) {
    result = "valid";
  } else {
    result = "invalid_token";
  }

  if (meta?.company_id || cred?.company_id) {
    await supabase.from("wid_verification_logs").insert({
      company_id: meta?.company_id || cred?.company_id,
      credential_id: cred?.id || null,
      identity_id: cred?.identity_id || null,
      qr_public_id: publicId,
      result,
      scanner_context: meta?.scanner_context || "dashboard",
      location_name: meta?.location_name || null,
      scanned_by: meta?.scanned_by || null,
      details: cred
        ? {
            name: cred.wid_identities?.full_name,
            identity_number: cred.wid_identities?.identity_number,
            status: cred.status,
          }
        : {},
    });
  }

  return { result, credential: cred };
}
