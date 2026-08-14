const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  let payload: Record<string, unknown> | null = null;
  const parts = token.split(".");
  if (parts.length === 3) {
    try {
      const json = Buffer.from(parts[1] as string, "base64").toString("utf8");
      payload = JSON.parse(json) as Record<string, unknown>;
    } catch {
      payload = null;
    }
  }
  return payload;
};

export const earliestTokenExpiryMs = (tokens: string[]): number | null => {
  let earliest: number | null = null;
  for (const token of tokens) {
    const payload = decodeJwtPayload(token);
    const exp = payload?.exp;
    if (typeof exp === "number") {
      const expiryMs = exp * 1000;
      if (earliest === null || expiryMs < earliest) {
        earliest = expiryMs;
      }
    }
  }
  return earliest;
};
