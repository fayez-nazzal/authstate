import { expect, test } from "bun:test";
import { pruneJars, revokeJar } from "@jar/lifecycle";
import type { JarStore } from "@jar/jar-store";

const makeStore = (files: Record<string, string>): JarStore => {
  const removed: string[] = [];
  return {
    read: async (path) => (files[path.split("/").pop() as string] != null ? files[path.split("/").pop() as string] as string : null),
    writeAtomic: async () => {},
    exists: async (path) => files[path.split("/").pop() as string] != null,
    remove: async (path) => {
      removed.push(path);
      delete files[path.split("/").pop() as string];
    },
    list: async () => Object.keys(files).filter((name) => name.endsWith(".json")),
    modes: () => ({ file: 0o600, dir: 0o700 }),
  };
};

test("revokeJar removes both the jar and its lock", async () => {
  const files: Record<string, string> = { "app--user.json": "{}" };
  const store = makeStore(files);
  let removedPaths: string[] = [];
  store.remove = async (path) => {
    removedPaths.push(path);
  };
  await revokeJar(store, "/dir/app--user.json");
  expect(removedPaths).toContain("/dir/app--user.json");
  expect(removedPaths).toContain("/dir/app--user.json.lock");
});

test("prune removes only jars the maths proves dead", async () => {
  const now = Math.floor(Date.now() / 1000);
  const files: Record<string, string> = {
    "dead.json": JSON.stringify({ cookies: [{ name: "s", expires: now - 100 }], origins: [] }),
    "alive.json": JSON.stringify({ cookies: [{ name: "s", expires: now + 3600 }], origins: [] }),
  };
  const store = makeStore(files);
  const pruned = await pruneJars(store, "/dir", now * 1000);
  expect(pruned).toEqual(["dead.json"]);
});
