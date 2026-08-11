import { promises as dns } from "dns";
import { isIPv4, isIPv6 } from "net";

// SSRF guard for the custom-rest geocoding adapter (plan §4g). Also called at
// save-time validation by the vault layer so a bad baseUrl is rejected before
// it ever hits an outbound request. Fail-closed: any ambiguity throws.

export type HostResolver = (hostname: string) => Promise<string[]>;

export const defaultHostResolver: HostResolver = async (hostname) => {
  // { all: true } returns every A/AAAA record so a rebind that flips one of
  // several answers into a private range still trips the check. { verbatim:
  // true } preserves DNS order so no address is silently dropped.
  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  return results.map((r) => r.address);
};

export async function assertSafeUrl(
  rawUrl: string,
  resolver: HostResolver = defaultHostResolver
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("ssrf_invalid_url");
  }
  if (url.protocol !== "https:") throw new Error("ssrf_scheme_not_https");
  const host = url.hostname;
  // Direct-IP baseUrls: skip DNS, check the literal.
  if (isIPv4(host) || isIPv6(host)) {
    if (isBlockedIp(host)) throw new Error("ssrf_blocked_ip");
    return url;
  }
  let ips: string[];
  try {
    ips = await resolver(host);
  } catch {
    throw new Error("ssrf_dns_failure");
  }
  if (ips.length === 0) throw new Error("ssrf_no_ip");
  for (const ip of ips) {
    if (isBlockedIp(ip)) throw new Error("ssrf_blocked_ip");
  }
  return url;
}

export function isBlockedIp(ip: string): boolean {
  if (isIPv4(ip)) return isBlockedIpv4(ip);
  if (isIPv6(ip)) {
    // ::ffff:x.x.x.x → unwrap and re-check the embedded v4.
    const mapped = extractMappedIpv4(ip);
    if (mapped) return isBlockedIpv4(mapped);
    return isBlockedIpv6(ip);
  }
  return true;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 127) return true; // loopback 127/8
  if (a === 10) return true; // RFC1918 10/8
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918 172.16/12
  if (a === 192 && b === 168) return true; // RFC1918 192.168/16
  if (a === 169 && b === 254) return true; // link-local 169.254/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a >= 224 && a <= 239) return true; // multicast 224/4
  if (a >= 240) return true; // reserved 240/4 + broadcast 255.255.255.255
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  // fc00::/7 unique-local (fc00 – fdff)
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  // fe80::/10 link-local (fe80 – febf)
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
  // multicast ff00::/8
  if (/^ff[0-9a-f]{2}:/.test(lower)) return true;
  return false;
}

function extractMappedIpv4(ip: string): string | null {
  // Forms: "::ffff:127.0.0.1" (dotted) or "::ffff:7f00:1" (hex).
  const lower = ip.toLowerCase();
  const marker = "::ffff:";
  const idx = lower.indexOf(marker);
  if (idx < 0) return null;
  const suffix = ip.slice(idx + marker.length);
  if (isIPv4(suffix)) return suffix;
  const groups = suffix.split(":");
  if (groups.length === 2) {
    const hi = parseInt(groups[0], 16);
    const lo = parseInt(groups[1], 16);
    if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
      const a = (hi >> 8) & 0xff;
      const b = hi & 0xff;
      const c = (lo >> 8) & 0xff;
      const d = lo & 0xff;
      return `${a}.${b}.${c}.${d}`;
    }
  }
  return null;
}
