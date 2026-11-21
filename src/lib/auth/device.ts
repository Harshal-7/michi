/** "phone", "laptop" or "device" from a User-Agent, for "Signed in on this phone". */
export function deviceFromUserAgent(ua: string | null | undefined): "phone" | "laptop" | "device" {
  if (!ua) return "device";
  if (/Android|iPhone|iPad|Mobile/i.test(ua)) return "phone";
  if (/Macintosh|Windows NT|CrOS|Linux x86_64|X11/i.test(ua)) return "laptop";
  return "device";
}

/** Where to go after signing in: a path on this site, never another site. */
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  if (value.startsWith("/sign-in")) return "/";
  return value;
}
