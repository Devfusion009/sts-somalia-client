/** Turns a raw user-agent into something a person can recognise their own device by. */
export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return "Unknown device";

  const os = /Windows/i.test(userAgent)
    ? "Windows"
    : /iPhone|iPad|iOS/i.test(userAgent)
      ? "iOS"
      : /Android/i.test(userAgent)
        ? "Android"
        : /Mac OS X|Macintosh/i.test(userAgent)
          ? "macOS"
          : /CrOS/i.test(userAgent)
            ? "ChromeOS"
            : /Linux/i.test(userAgent)
              ? "Linux"
              : "Unknown OS";

  // Order matters: Edge, Opera and Samsung Internet all claim "Chrome", and
  // Chrome claims "Safari", so the most specific token is tested first.
  const browser = /Edg\//i.test(userAgent)
    ? "Edge"
    : /OPR\//i.test(userAgent)
      ? "Opera"
      : /SamsungBrowser\//i.test(userAgent)
        ? "Samsung Internet"
        : /Chrome\//i.test(userAgent)
          ? "Chrome"
          : /Firefox\//i.test(userAgent)
            ? "Firefox"
            : /Safari\//i.test(userAgent)
              ? "Safari"
              : "Unknown browser";

  return `${browser} on ${os}`;
}

/** The Supabase session id (`session_id` claim) inside an access token, without verifying it. */
export function sessionIdFromAccessToken(accessToken: string | null | undefined): string | null {
  const payload = accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as {
      session_id?: unknown;
    };
    return typeof json.session_id === "string" ? json.session_id : null;
  } catch {
    return null;
  }
}

/** "Mogadishu, SO" / "SO" / null from the location recorded with an event. */
export function describeLocation(city: string | null | undefined, country: string | null | undefined): string | null {
  if (city && country) return `${city}, ${country}`;
  return city || country || null;
}
