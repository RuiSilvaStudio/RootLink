/**
 * Guards against rendering image URLs that point at localhost or a private
 * network address. Modern Firefox (150+) blocks public sites from loading such
 * resources and shows a "wants to access other apps and services on this device"
 * permission prompt. Stale data (e.g. an avatar uploaded in dev) could otherwise
 * trigger that prompt on production. Any unsafe/non-web URL collapses to the
 * provided fallback so the UI shows a placeholder instead.
 */

// Our own backend/media origin is trusted even when it is localhost in dev.
// (The private-host guard is meant for stale third-party data, not our media server.)
const API_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001").origin;
  } catch {
    return "";
  }
})();

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h === "::1" || h.endsWith(".local")) return true;
  if (/^127\./.test(h)) return true; // loopback
  if (/^10\./.test(h)) return true; // private class A
  if (/^192\.168\./.test(h)) return true; // private class C
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true; // private class B
  if (/^169\.254\./.test(h)) return true; // link-local
  return false;
}

/**
 * Returns `url` if it is a safe, publicly-loadable image source; otherwise
 * returns `fallback`. Allows root-relative paths and data:/blob: URLs as-is.
 */
export function safeImageUrl(url?: string | null, fallback = ""): string {
  if (!url) return fallback;
  const u = String(url).trim();
  if (!u) return fallback;
  // Root-relative paths and inline data are always safe.
  if (u.startsWith("/") || u.startsWith("data:") || u.startsWith("blob:")) return u;

  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return fallback; // not a parseable absolute URL (and not root-relative)
  }
  // Only http(s) may be auto-loaded; custom schemes also trigger the prompt.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return fallback;
  // Always trust our own backend (where uploaded media is served from).
  if (API_ORIGIN && parsed.origin === API_ORIGIN) return u;
  if (isPrivateHost(parsed.hostname)) return fallback;
  return u;
}
