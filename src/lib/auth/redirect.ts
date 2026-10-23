// Decode before checking: browsers normalize encoded slashes and backslashes.
export function safeRedirect(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded)) return fallback;
    const base = new URL("https://internal.invalid");
    const target = new URL(decoded, base);
    if (target.origin !== base.origin || target.pathname.startsWith("//") || /%(?:25|2f|5c|0[0-9a-f]|1[0-9a-f])/i.test(decoded)) return fallback;
    return target.pathname + target.search + target.hash;
  } catch { return fallback; }
}
