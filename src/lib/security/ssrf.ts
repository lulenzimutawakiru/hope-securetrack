/**
 * SSRF guard for user-supplied URLs handed to server-side provider clients
 * (e.g. OCR content_url). Fail closed: only public http(s) URLs with no
 * credentials, default ports, and no loopback / private / link-local /
 * reserved targets (including via DNS resolution) are accepted.
 *
 * This module is server-only (imports node:dns) and must never be imported
 * from client components.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const PRIVATE_IPV4_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 0x00ffffff], // 0.0.0.0/8
  [0x0a000000, 0x0affffff], // 10.0.0.0/8
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8 loopback
  [0x64400000, 0x647fffff], // 100.64.0.0/10 CGNAT
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 link-local (cloud metadata)
  [0xac100000, 0xac1fffff], // 172.16.0.0/12
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
  [0xc0000000, 0xc00000ff], // 192.0.0.0/24 IETF protocol assignments
  [0xc6120000, 0xc612ffff], // 198.18.0.0/15 benchmarking
  [0xc6336400, 0xc63364ff], // 198.51.100.0/24 TEST-NET-1
  [0xcb007100, 0xcb0071ff], // 203.0.113.0/24 TEST-NET-3
  [0xe0000000, 0xefffffff], // 224.0.0.0/4 multicast
  [0xf0000000, 0xffffffff], // 240.0.0.0/4 reserved
];

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const num =
    ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  return PRIVATE_IPV4_RANGES.some(([lo, hi]) => num >= lo && num <= hi);
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped address: validate the embedded IPv4 literal.
    const v4 = lower.slice("::ffff:".length);
    return v4.includes(".") ? isPrivateIpv4(v4) : true;
  }
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 ULA
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link-local
  if (lower.startsWith("ff")) return true; // ff00::/8 multicast
  return false;
}

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home.arpa",
];

export async function assertPublicHttpUrl(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "URL is not parseable";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Only http(s) URLs are allowed";
  }
  if (parsed.username || parsed.password) {
    return "URL credentials are not allowed";
  }
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    return "Only default http(s) ports are allowed";
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return "URL host is missing";
  if (
    host === "localhost" ||
    host === "metadata.google.internal" ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    return "Private or reserved hostname is not allowed";
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    return isPrivateIpv4(host) ? "Private or reserved IP is not allowed" : null;
  }
  if (ipVersion === 6) {
    return isPrivateIpv6(host) ? "Private or reserved IP is not allowed" : null;
  }

  if (!host.includes(".")) {
    return "Single-label hostnames are not allowed";
  }

  let addresses: string[];
  try {
    addresses = (await lookup(host, { all: true, verbatim: true })).map(
      (a) => a.address
    );
  } catch {
    return "Hostname could not be resolved";
  }
  if (!addresses.length) return "Hostname did not resolve to an address";
  for (const addr of addresses) {
    const version = isIP(addr);
    if (version === 4 && isPrivateIpv4(addr)) {
      return "Hostname resolves to a private or reserved address";
    }
    if (version === 6 && isPrivateIpv6(addr)) {
      return "Hostname resolves to a private or reserved address";
    }
  }
  return null;
}
