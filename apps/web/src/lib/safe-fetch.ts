import "server-only";
import dns from "node:dns/promises";
import net from "node:net";

/**
 * Rejects a URL an admin-configured integration is about to have the server
 * fetch() before the request goes out — the "custom" visa-processing adapter
 * (modules/visa/partner/adapters/custom.ts) is the only caller today, but
 * the check is generic because "admin types a URL, server fetches it" is an
 * SSRF vector regardless of feature. Requires https, then resolves the
 * hostname and blocks private/loopback/link-local ranges — an admin account
 * is trusted with a lot in this app, but a typo'd or malicious integration
 * URL should not be a path to the app's own internal network (Supabase,
 * Redis, the API service all sit on the same Docker network).
 */
export async function assertSafeExternalUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Not a valid URL: ${rawUrl}`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`Only https:// URLs are allowed: ${rawUrl}`);
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error(`Refusing to call a local hostname: ${hostname}`);
  }

  let address: string;
  if (net.isIP(hostname)) {
    address = hostname;
  } else {
    try {
      address = (await dns.lookup(hostname)).address;
    } catch {
      throw new Error(`Could not resolve hostname: ${hostname}`);
    }
  }

  if (isPrivateOrReservedIp(address)) {
    throw new Error(`Refusing to call a private/reserved address: ${hostname} -> ${address}`);
  }
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 127 || // loopback
      a === 10 || // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) || // 192.168.0.0/16
      (a === 169 && b === 254) || // 169.254.0.0/16 (link-local, incl. cloud metadata)
      a === 0 // 0.0.0.0/8
    );
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    return (
      normalized === "::1" || // loopback
      normalized.startsWith("fc") || // unique local fc00::/7
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80") // link-local
    );
  }
  return true; // unrecognised format — fail closed
}
