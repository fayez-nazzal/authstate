export type JarCookie = {
  name: string;
  expires: number;
};

export type JarContents = {
  cookies: JarCookie[];
  originTokens: string[];
};

const collectOriginTokens = (origins: unknown): string[] => {
  const tokens: string[] = [];
  if (Array.isArray(origins)) {
    for (const origin of origins) {
      const storage = (origin as { localStorage?: Array<{ value?: string }> }).localStorage;
      if (Array.isArray(storage)) {
        for (const item of storage) {
          if (typeof item.value === "string") {
            tokens.push(item.value);
          }
        }
      }
    }
  }
  return tokens;
};

export const parseJarContents = (raw: string): JarContents => {
  const parsed = JSON.parse(raw) as { cookies?: JarCookie[]; origins?: unknown };
  const cookies = Array.isArray(parsed.cookies) ? parsed.cookies : [];
  const originTokens = collectOriginTokens(parsed.origins);
  return { cookies, originTokens };
};
