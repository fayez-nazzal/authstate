import type { JarCookie } from "@jar/jar-contents";

export const earliestCookieExpiryMs = (cookies: JarCookie[]): number | null => {
  let earliest: number | null = null;
  for (const cookie of cookies) {
    if (cookie.expires != null && cookie.expires > 0) {
      const expiryMs = cookie.expires * 1000;
      if (earliest === null || expiryMs < earliest) {
        earliest = expiryMs;
      }
    }
  }
  return earliest;
};
