import type { JarStore } from "@jar/jar-store";
import { parseJarContents } from "@jar/jar-contents";
import { earliestCookieExpiryMs } from "@freshness/cookie-expiry";
import { earliestTokenExpiryMs } from "@freshness/token-expiry";
import { decideFreshness } from "@freshness/freshness-verdict";

export const revokeJar = async (jarStore: JarStore, statePath: string): Promise<void> => {
  await jarStore.remove(statePath);
  await jarStore.remove(`${statePath}.lock`);
};

const isJarDead = async (jarStore: JarStore, path: string, nowMs: number): Promise<boolean> => {
  const contents = await jarStore.read(path);
  let dead = true;
  if (contents !== null) {
    const parsed = parseJarContents(contents);
    const cookieMs = earliestCookieExpiryMs(parsed.cookies);
    const tokenMs = earliestTokenExpiryMs(parsed.originTokens);
    const verdict = decideFreshness(cookieMs, tokenMs, nowMs);
    dead = verdict.verdict === "proven-dead";
  }
  return dead;
};

export const pruneJars = async (jarStore: JarStore, dir: string, nowMs: number): Promise<string[]> => {
  const names = await jarStore.list(dir);
  const pruned: string[] = [];
  for (const name of names) {
    const path = `${dir}/${name}`;
    const dead = await isJarDead(jarStore, path, nowMs);
    if (dead) {
      await revokeJar(jarStore, path);
      pruned.push(name);
    }
  }
  return pruned;
};
