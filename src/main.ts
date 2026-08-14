#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { resolveAppKey } from "@account/app-key";
import { canonicalJarPath } from "@jar/jar-path";
import type { CredentialsEntry, CredentialsFile } from "@account/app-key";
import { createPlaywrightBrowserSession } from "@login/browser-session";
import { ExitCode } from "@verdict/exit-code";
import { writeResultLine } from "@verdict/result";
import type { Result } from "@verdict/result";
import { writeHumanReport } from "@verdict/human-report";
import { parseCredentialsFile } from "@account/credentials-file";
import { resolveEntry } from "@account/entry-resolution";
import { createFsLockHolder, createSystemClock } from "@login-turn/lock-holder";
import { createFsJarStore } from "@jar/jar-store";
import { runEnsure } from "@ensure/ensure-run";
import type { EnsureWorld } from "@ensure/ensure-run";

export const VERSION = "0.2.0";

const HELP = `authstate ${VERSION} — the only thing that logs in, one jar per account

USAGE
  authstate ensure --credentials <yaml> [--purpose <name>]
  authstate path   --credentials <yaml> [--purpose <name>]

  ensure guarantees a valid Playwright storageState jar for one account and
  prints its path on stdout. A jar the expiry maths has not proven dead is
  reused without opening a browser. Missing, expired or rejected state
  triggers exactly one scripted login. Parallel callers collapse into one
  login through a per jar lockfile.

  path prints where that jar lives without touching the network, so a tool
  can resolve the jar before deciding to do anything.

OPTIONS
  --credentials <path>  .testing-credentials.yaml (schema: optional app name,
                        default entry name, and a credentials map of entries
                        with purpose, email, password, app_url, signed_in_when)
  --purpose <name>      credentials entry key, or a substring of its purpose
                        text. Falls back to the file's default entry
  --namespace <name>    extra key segment for a second, separate session on the
                        same account
  --force               skip the freshness check and re-login now
  --verify              also open a browser to confirm a jar the expiry
                        maths already calls fresh, instead of trusting it
  --headed              visible browser window, for an account whose login a
                        human must complete by hand (MFA, SSO)
  --timeout <ms>        per step timeout (default 20000)
  -h, --help            this help

EXIT CODES
  0 usable · 1 credentials rejected · 2 usage error · 3 credentials file
  invalid or assertion missing · 4 no entry matches / ambiguous ·
  5 lock timeout · 6 human step required · 7 tool could not run
`;

const log = (message: string) => {
  console.error(`authstate: ${message}`);
};

const expandHome = (path: string) => {
  let result = path;
  if (path.startsWith("~/")) {
    result = `${homedir()}/${path.slice(2)}`;
  }
  return result;
};

const fail = (message: string, code: number): never => {
  log(message);
  process.exit(code);
};

const resolveEntryOrFail = (file: CredentialsFile, purpose: string | undefined): { name: string; entry: CredentialsEntry } => {
  const resolution = resolveEntry(file, purpose);
  if (!resolution.ok) {
    fail(resolution.reason, ExitCode.entryNotFound);
  }
  const resolved = resolution as { ok: true; name: string; entry: CredentialsEntry };
  log(`using credentials entry "${resolved.name}" (${resolved.entry.email} @ ${resolved.entry.app_url})`);
  return { name: resolved.name, entry: resolved.entry };
};

const buildWorld = (): EnsureWorld => ({
  jarStore: createFsJarStore(),
  lockHolder: createFsLockHolder(),
  clock: createSystemClock(),
  openBrowserSession: (headed: boolean) => createPlaywrightBrowserSession(headed),
});

const LOCK_WAIT_MS = 150000;

const runPathCommand = (
  appKey: string,
  entryName: string,
  namespace: string | null,
  statePath: string,
): never => {
  const result: Result = {
    tool: "authstate",
    version: VERSION,
    command: "path",
    ok: true,
    status: "reused",
    reason: null,
    app: appKey,
    account: entryName,
    namespace,
    path: statePath,
    expires_at: null,
    seconds_remaining: null,
    expiry_source: "none",
    logged_in: null,
    proof: null,
    verified: false,
    browser_launched: false,
    exit_code: ExitCode.usable,
  };
  writeHumanReport(result);
  writeResultLine(result);
  process.exit(ExitCode.usable);
};

const runEnsureCommand = async (
  appKey: string,
  entryName: string,
  entry: CredentialsEntry,
  namespace: string | null,
  statePath: string,
  values: Record<string, unknown>,
  timeoutMs: number,
): Promise<never> => {
  const world = buildWorld();
  const result = await runEnsure(world, {
    request: { force: values.force as boolean, verify: values.verify as boolean },
    entry,
    entryName,
    app: appKey,
    namespace,
    statePath,
    lockDir: `${statePath}.lock`,
    headed: values.headed as boolean,
    timeoutMs,
    lockWaitMs: LOCK_WAIT_MS,
    version: VERSION,
  });
  writeHumanReport(result);
  writeResultLine(result);
  process.exit(result.exit_code);
};

export const main = async () => {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      credentials: { type: "string" },
      purpose: { type: "string" },
      namespace: { type: "string" },
      force: { type: "boolean", default: false },
      verify: { type: "boolean", default: false },
      headed: { type: "boolean", default: false },
      timeout: { type: "string", default: "20000" },
      out: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const command = positionals[0];
  const knownCommand = command === "ensure" || command === "path";
  if (values.help || !knownCommand) {
    console.log(HELP);
    process.exit(values.help ? 0 : ExitCode.usageError);
  }
  if (values.out) {
    fail("--out was removed, use --namespace for a second session on one account", ExitCode.usageError);
  }
  if (!values.credentials) {
    fail("--credentials is required", ExitCode.usageError);
  }

  const credentialsPath = resolve(expandHome(values.credentials as string));
  const timeoutMs = Number(values.timeout);
  if (!existsSync(credentialsPath)) {
    fail(`credentials file not found: ${credentialsPath}`, ExitCode.credentialsFileInvalid);
  }

  const parsed = parseCredentialsFile(credentialsPath);
  if (!parsed.ok) {
    fail(parsed.reason, ExitCode.credentialsFileInvalid);
  }
  const file = (parsed as { ok: true; file: CredentialsFile }).file;
  const resolved = resolveEntryOrFail(file, values.purpose);
  const appKey = resolveAppKey(file, credentialsPath);
  const namespace = (values.namespace as string | undefined) || null;
  const statePath = canonicalJarPath(appKey, resolved.name, namespace || undefined);
  mkdirSync(dirname(statePath), { recursive: true });

  if (command === "path") {
    runPathCommand(appKey, resolved.name, namespace, statePath);
  }

  await runEnsureCommand(appKey, resolved.name, resolved.entry, namespace, statePath, values, timeoutMs);
};

if (import.meta.main) {
  await main();
}
