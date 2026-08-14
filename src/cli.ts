#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { existsSync, mkdirSync, readFileSync, renameSync, rmdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";

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

export function normalizeAppKey(raw: string): string {
  let key = raw.trim().toLowerCase();
  const dot = key.indexOf(".");
  if (dot > 0) {
    key = key.slice(0, dot);
  }
  key = key.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (key === "") {
    key = "app";
  }
  return key;
}

export function jarFileName(app: string, purpose: string, namespace?: string): string {
  let name = `${normalizeAppKey(app)}--${normalizeAppKey(purpose)}`;
  if (namespace != null && namespace !== "") {
    name = `${name}--${normalizeAppKey(namespace)}`;
  }
  return `${name}.json`;
}

export function canonicalJarPath(app: string, purpose: string, namespace?: string): string {
  return `${homedir()}/.authstate/${jarFileName(app, purpose, namespace)}`;
}

type CredentialsEntry = {
  purpose?: string;
  email: string;
  password: string;
  app_url: string;
};

type CredentialsFile = {
  app?: string;
  default?: string;
  credentials: Record<string, CredentialsEntry>;
};

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

export const resolveAppKey = (file: CredentialsFile, credentialsPath: string): string => {
  let raw = file.app;
  if (raw == null || raw === "") {
    raw = basename(dirname(credentialsPath));
  }
  return normalizeAppKey(raw);
};

const resolveEntry = (file: CredentialsFile, purpose: string | undefined): { name: string; entry: CredentialsEntry } => {
  let entryName = file.default;
  if (purpose) {
    entryName = undefined;
    if (file.credentials[purpose]) {
      entryName = purpose;
    } else {
      for (const [name, entry] of Object.entries(file.credentials)) {
        const purposeText = entry.purpose || "";
        if (purposeText.toLowerCase().includes(purpose.toLowerCase())) {
          entryName = name;
          break;
        }
      }
    }
  }
  if (!entryName || !file.credentials[entryName]) {
    fail(`no credentials entry matches "${purpose || "(default)"}"`, 2);
  }
  const name = entryName as string;
  const entry = file.credentials[name];
  log(`using credentials entry "${name}" (${entry.email} @ ${entry.app_url})`);
  return { name, entry };
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

const launchBrowser = async (headed: boolean): Promise<Browser> => {
  let browser: Browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: !headed });
  } catch {
    log("Chrome unavailable, falling back to bundled Chromium");
    browser = await chromium.launch({ headless: !headed });
  }
  return browser;
};

const passwordFieldCount = async (page: Page): Promise<number> => {
  let count = 0;
  try {
    count = await page.locator("input[type='password']:visible").count();
  } catch {}
  return count;
};

const looksLoggedIn = async (page: Page, appOrigin: string, timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  let verdict = false;
  let settled = false;
  while (!settled && Date.now() < deadline) {
    const passwordFields = await passwordFieldCount(page);
    const currentOrigin = new URL(page.url()).origin;
    if (passwordFields > 0) {
      verdict = false;
      settled = true;
    } else if (currentOrigin === appOrigin) {
      const bodyText = await page.evaluate(() => document.body.innerText.trim().length).catch(() => 0);
      if (bodyText > 0) {
        verdict = true;
        settled = true;
      }
    }
    if (!settled) {
      await Bun.sleep(500);
    }
  }
  return verdict;
};

const saveStateAtomic = async (context: BrowserContext, statePath: string) => {
  const temp = `${statePath}.tmp-${process.pid}`;
  await context.storageState({ path: temp });
  renameSync(temp, statePath);
};

const probeState = async (statePath: string, entry: CredentialsEntry, headed: boolean, timeoutMs: number): Promise<boolean> => {
  let valid = false;
  const browser = await launchBrowser(headed);
  try {
    const context = await browser.newContext({ storageState: statePath });
    const page = await context.newPage();
    await page.goto(entry.app_url, { waitUntil: "load", timeout: timeoutMs });
    const appOrigin = new URL(entry.app_url).origin;
    valid = await looksLoggedIn(page, appOrigin, Math.min(timeoutMs, 10000));
    if (valid) {
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      await saveStateAtomic(context, statePath);
      log("captured rotated tokens back into the jar");
    }
  } catch (error) {
    log(`probe errored, treating state as stale (${error})`);
    valid = false;
  } finally {
    await browser.close();
  }
  return valid;
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

const login = async (statePath: string, entry: CredentialsEntry, headed: boolean, timeoutMs: number): Promise<boolean> => {
  let succeeded = false;
  const browser = await launchBrowser(headed);
  try {
    const context: BrowserContext = await browser.newContext();
    const page = await context.newPage();
    log(`logging in at ${entry.app_url}`);
    await page.goto(entry.app_url, { waitUntil: "load", timeout: timeoutMs });
    await fillLoginForm(page, entry, timeoutMs);
    const appOrigin = new URL(entry.app_url).origin;
    const loggedIn = await looksLoggedIn(page, appOrigin, timeoutMs);
    if (loggedIn) {
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      mkdirSync(dirname(statePath), { recursive: true });
      await saveStateAtomic(context, statePath);
      log(`wrote ${statePath}`);
      succeeded = true;
    } else {
      log("login did not reach an authenticated app state");
    }
  } catch (error) {
    log(`login failed (${error})`);
  } finally {
    await browser.close();
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
    fail(`credentials file not found: ${credentialsPath}`, 2);
  }

  const file = Bun.YAML.parse(readFileSync(credentialsPath, "utf8")) as CredentialsFile;
  const resolved = resolveEntry(file, values.purpose);
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
    console.log(statePath);
    process.exit(0);
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
      const valid = await probeState(statePath, entry, values.headed as boolean, timeoutMs);
      if (valid) {
        log("state is valid, reusing");
        needLogin = false;
      } else {
        log("state is stale");
      }
    }
    if (needLogin) {
      const succeeded = await login(statePath, entry, values.headed as boolean, timeoutMs);
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
