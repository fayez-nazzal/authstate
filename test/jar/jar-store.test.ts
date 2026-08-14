import { expect, test } from "bun:test";
import { createFsJarStore } from "@jar/jar-store";

test("jar files are 0600 and jar directories are 0700", () => {
  const store = createFsJarStore();
  const modes = store.modes();
  expect(modes.file).toBe(0o600);
  expect(modes.dir).toBe(0o700);
});
