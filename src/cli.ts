#!/usr/bin/env bun

export { normalizeAppKey, resolveAppKey } from "@account/app-key";
export { canonicalJarPath, jarFileName } from "@jar/jar-path";
export { VERSION, main } from "./main.ts";

import { main } from "./main.ts";

if (import.meta.main) {
  await main();
}
