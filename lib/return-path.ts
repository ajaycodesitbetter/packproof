// Redirects must remain on this site. A leading slash alone is not enough:
// protocol-relative URLs (//host) and backslashes can escape the origin.
export function safeReturnPath(value: unknown, fallback = "/library"): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  if (/[\\\u0000-\u0020]/.test(value)) return fallback;
  try {
    const base = "https://packproof.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    if (url.pathname === "/signin" || url.pathname.startsWith("/api/auth/")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
