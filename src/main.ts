#!/usr/bin/env bun

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
import { pruneJars, revokeJar } from "@jar/lifecycle";
import { parseRequest } from "@invocation/request";
import type { Request } from "@invocation/request";
import { HELP_TEXT, VERSION } from "@invocation/help";

export { VERSION } from "@invocation/help";

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

const runPathCommand = (appKey: string, entryName: string, namespace: string | null, statePath: string): never => {
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
  request: Request,
): Promise<never> => {
  const headed = request.command === "login";
  const forceLogin = headed || request.force;
  if (!headed && !entry.password) {
    fail(
      `entry "${entryName}" has no password and needs a human, run: authstate login --headed`,
      ExitCode.humanStepRequired,
    );
  }
  const world = buildWorld();
  const result = await runEnsure(world, {
    request: { force: forceLogin, verify: request.verify },
    entry,
    entryName,
    app: appKey,
    namespace,
    statePath,
    lockDir: `${statePath}.lock`,
    headed,
    timeoutMs: request.timeoutMs,
    lockWaitMs: LOCK_WAIT_MS,
    version: VERSION,
  });
  writeHumanReport(result);
  writeResultLine(result);
  process.exit(result.exit_code);
};

const runRevokeCommand = async (statePath: string): Promise<never> => {
  const jarStore = createFsJarStore();
  await revokeJar(jarStore, statePath);
  log(`revoked ${statePath}`);
  process.exit(ExitCode.usable);
};

const runPruneCommand = async (statePath: string): Promise<never> => {
  const jarStore = createFsJarStore();
  const pruned = await pruneJars(jarStore, dirname(statePath), Date.now());
  log(`pruned ${pruned.length} jar(s): ${pruned.join(", ")}`);
  process.exit(ExitCode.usable);
};

export const main = async () => {
  const parsed = parseRequest(process.argv.slice(2));
  if (!parsed.ok) {
    if (parsed.showHelp) {
      console.log(HELP_TEXT);
    } else {
      log(parsed.reason);
    }
    process.exit(parsed.exitCode);
  }
  const request = parsed.request;

  const credentialsPath = resolve(expandHome(request.credentials));
  if (!existsSync(credentialsPath)) {
    fail(`credentials file not found: ${credentialsPath}`, ExitCode.credentialsFileInvalid);
  }

  const parsedFile = parseCredentialsFile(credentialsPath);
  if (!parsedFile.ok) {
    fail(parsedFile.reason, ExitCode.credentialsFileInvalid);
  }
  const file = (parsedFile as { ok: true; file: CredentialsFile }).file;
  const resolved = resolveEntryOrFail(file, request.purpose);
  const appKey = resolveAppKey(file, credentialsPath);
  const namespace = request.namespace || null;
  const statePath = canonicalJarPath(appKey, resolved.name, namespace || undefined);
  mkdirSync(dirname(statePath), { recursive: true });

  if (request.command === "path") {
    runPathCommand(appKey, resolved.name, namespace, statePath);
  }
  if (request.command === "revoke") {
    await runRevokeCommand(statePath);
  }
  if (request.command === "prune") {
    await runPruneCommand(statePath);
  }

  await runEnsureCommand(appKey, resolved.name, resolved.entry, namespace, statePath, request);
};

if (import.meta.main) {
  await main();
}
