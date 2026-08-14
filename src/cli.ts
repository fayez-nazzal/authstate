#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { existsSync, mkdirSync, rmdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import type { Page } from "playwright";
import { normalizeAppKey, resolveAppKey } from "@account/app-key";
import { canonicalJarPath, jarFileName } from "@jar/jar-path";
import type { CredentialsEntry, CredentialsFile } from "@account/app-key";
import { createPlaywrightBrowserSession } from "@login/browser-session";
import type { SignInAssertion } from "@login/browser-session";
import { proofFromObservation } from "@signin-proof/proof";
import { ExitCode } from "@verdict/exit-code";
import { writeResultLine } from "@verdict/result";
import type { Result } from "@verdict/result";
import { writeHumanReport } from "@verdict/human-report";
import { parseCredentialsFile } from "@account/credentials-file";
import { resolveEntry } from "@account/entry-resolution";
import { parseSignedInWhen } from "@signin-proof/assertion";

export { normalizeAppKey, resolveAppKey } from "@account/app-key";
export { canonicalJarPath, jarFileName } from "@jar/jar-path";

export const VERSION = "0.2.0";

const HELP = `authstate ${VERSION} — the only thing that logs in, one jar per account

USAGE
  authstate ensure --credentials <yaml> [--purpose <name>] [--out <state.json>]
  authstate path   --credentials <yaml> [--purpose <name>]

  ensure guarantees a valid Playwright storageState jar for one account and
  prints its path on stdout. Valid state on disk is reused untouched. Missing,
  expired or rejected state triggers exactly one scripted login. Parallel
  callers collapse into one login through a per jar lockfile.

  path prints where that jar lives without touching the network, so a tool can
  resolve the jar before deciding to do anything.

  Every account gets its own jar and its own lock, so agents working on
  different accounts never block or overwrite each other, and agents sharing an
  account share one login.

  No other tool should own credentials. Browser tools take the jar path and
  nothing else.

OPTIONS
  --credentials <path>  .testing-credentials.yaml (schema: optional app name,
                        default entry name, and a credentials map of entries
                        with purpose, email, password, app_url)
  --purpose <name>      credentials entry key, or a substring of its purpose
                        text. Falls back to the file's default entry
  --out <path>          override the jar location. Omit to use the canonical
                        path ~/.authstate/<app>--<purpose>.json
  --namespace <name>    extra key segment for a second, separate session on the
                        same account
  --force               skip the validity probe and re-login now
  --headed              visible browser window, for an account whose login a
                        human must complete by hand (MFA, SSO)
  --timeout <ms>        per step timeout (default 20000)
  -h, --help            this help

EXIT CODES
  0 jar is valid (reused or refreshed) · 1 login failed · 2 bad usage
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

const LOCK_STALE_MS = 180000;
const LOCK_WAIT_MS = 150000;

const acquireLock = async (lockDir: string): Promise<boolean> => {
  const started = Date.now();
  let acquired = false;
  while (!acquired) {
    try {
      mkdirSync(lockDir);
      acquired = true;
    } catch {
      let lockAge = 0;
      try {
        lockAge = Date.now() - statSync(lockDir).mtimeMs;
      } catch {
        continue;
      }
      if (lockAge > LOCK_STALE_MS) {
        log("removing stale lock");
        try {
          rmdirSync(lockDir);
        } catch {}
        continue;
      }
      if (Date.now() - started > LOCK_WAIT_MS) {
        return false;
      }
      log("another authstate is logging in, waiting…");
      await Bun.sleep(2000);
    }
  }
  return true;
};

const releaseLock = (lockDir: string) => {
  try {
    rmdirSync(lockDir);
  } catch {}
};

const assertionFor = (entry: CredentialsEntry, entryName: string): SignInAssertion => {
  const parsed = parseSignedInWhen(entry.signed_in_when, entryName);
  let assertion: SignInAssertion;
  if (parsed.ok) {
    assertion = parsed.assertion;
  } else {
    assertion = { urlMatches: `${new URL(entry.app_url).origin}/**` };
  }
  return assertion;
};

const fillLoginForm = async (page: Page, entry: CredentialsEntry, timeoutMs: number) => {
  const passwordField = page.locator("input[type='password']:visible").first();
  await passwordField.waitFor({ state: "visible", timeout: timeoutMs });
  let emailField = page.getByRole("textbox", { name: /email/i }).first();
  const emailByRole = await emailField.count();
  if (emailByRole === 0) {
    emailField = page.locator("input[type='email']:visible, input[name*='email' i]:visible").first();
  }
  await emailField.fill(entry.email);
  await passwordField.fill(entry.password);
  let submit = page.getByRole("button", { name: /sign in|log in|login|sign-in/i }).first();
  const submitByRole = await submit.count();
  if (submitByRole === 0) {
    submit = page.locator("button[type='submit']:visible, input[type='submit']:visible").first();
  }
  await submit.click();
};

const probeState = async (statePath: string, entry: CredentialsEntry, entryName: string, headed: boolean, timeoutMs: number): Promise<boolean> => {
  let valid = false;
  const session = createPlaywrightBrowserSession(headed);
  try {
    await session.open(statePath);
    await session.run(async (page) => {
      await page.goto(entry.app_url, { waitUntil: "load", timeout: timeoutMs });
    });
    const observation = await session.observe(assertionFor(entry, entryName), Math.min(timeoutMs, 10000));
    valid = proofFromObservation(observation) === "signed-in";
    if (valid) {
      await session.capture(statePath);
      log("captured rotated tokens back into the jar");
    }
  } catch (error) {
    log(`probe errored, treating state as stale (${error})`);
    valid = false;
  } finally {
    await session.close();
  }
  return valid;
};

const login = async (statePath: string, entry: CredentialsEntry, entryName: string, headed: boolean, timeoutMs: number): Promise<boolean> => {
  let succeeded = false;
  const session = createPlaywrightBrowserSession(headed);
  try {
    await session.open();
    log(`logging in at ${entry.app_url}`);
    await session.run(async (page) => {
      await page.goto(entry.app_url, { waitUntil: "load", timeout: timeoutMs });
      await fillLoginForm(page, entry, timeoutMs);
    });
    const observation = await session.observe(assertionFor(entry, entryName), timeoutMs);
    const loggedIn = proofFromObservation(observation) === "signed-in";
    if (loggedIn) {
      mkdirSync(dirname(statePath), { recursive: true });
      await session.capture(statePath);
      log(`wrote ${statePath}`);
      succeeded = true;
    } else {
      log("login did not reach an authenticated app state");
    }
  } catch (error) {
    log(`login failed (${error})`);
  } finally {
    await session.close();
  }
  return succeeded;
};

const main = async () => {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      credentials: { type: "string" },
      purpose: { type: "string" },
      out: { type: "string" },
      namespace: { type: "string" },
      force: { type: "boolean", default: false },
      headed: { type: "boolean", default: false },
      timeout: { type: "string", default: "20000" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const command = positionals[0];
  const knownCommand = command === "ensure" || command === "path";
  if (values.help || !knownCommand) {
    console.log(HELP);
    process.exit(values.help ? 0 : 2);
  }
  if (!values.credentials) {
    fail("--credentials is required", 2);
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
  const entry = resolved.entry;

  let statePath: string;
  if (values.out) {
    statePath = resolve(expandHome(values.out as string));
  } else {
    const appKey = resolveAppKey(file, credentialsPath);
    statePath = canonicalJarPath(appKey, resolved.name, values.namespace as string | undefined);
  }
  mkdirSync(dirname(statePath), { recursive: true });

  if (command === "path") {
    const appKey = resolveAppKey(file, credentialsPath);
    const result: Result = {
      tool: "authstate",
      version: VERSION,
      command: "path",
      ok: true,
      status: "reused",
      reason: null,
      app: appKey,
      account: resolved.name,
      namespace: (values.namespace as string | undefined) || null,
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
  }

  const assertionResult = parseSignedInWhen(entry.signed_in_when, resolved.name);
  if (!assertionResult.ok) {
    fail(assertionResult.reason, ExitCode.credentialsFileInvalid);
  }

  const lockDir = `${statePath}.lock`;
  const lockAcquired = await acquireLock(lockDir);
  if (!lockAcquired) {
    fail("timed out waiting for another authstate login", 1);
  }

  let exitCode = 0;
  try {
    let needLogin = true;
    if (!values.force && existsSync(statePath)) {
      log(`probing existing state ${statePath}`);
      const valid = await probeState(statePath, entry, resolved.name, values.headed as boolean, timeoutMs);
      if (valid) {
        log("state is valid, reusing");
        needLogin = false;
      } else {
        log("state is stale");
      }
    }
    if (needLogin) {
      const succeeded = await login(statePath, entry, resolved.name, values.headed as boolean, timeoutMs);
      if (!succeeded) {
        exitCode = 1;
      }
    }
  } finally {
    releaseLock(lockDir);
  }
  if (exitCode === 0) {
    console.log(statePath);
  }
  process.exit(exitCode);
};

if (import.meta.main) {
  await main();
}
