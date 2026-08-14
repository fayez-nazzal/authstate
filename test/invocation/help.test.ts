import { expect, test } from "bun:test";
import { EXIT_TABLE } from "@invocation/help";
import { ExitCode } from "@verdict/exit-code";

test("every ExitCode value has exactly one documented row", () => {
  const codes = Object.values(ExitCode);
  const documented = EXIT_TABLE.map((row) => row.code);
  expect(documented.sort()).toEqual([...codes].sort());
});

test("no undocumented exit code is reachable through the table", () => {
  const knownCodes = new Set(Object.values(ExitCode));
  for (const row of EXIT_TABLE) {
    expect(knownCodes.has(row.code as (typeof ExitCode)[keyof typeof ExitCode])).toBe(true);
  }
});
