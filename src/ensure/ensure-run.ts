import type { CredentialsEntry } from "@account/app-key";
import type { JarStore } from "@jar/jar-store";
import type { LockHolder, Clock } from "@login-turn/lock-holder";
import { acquireLockTurn } from "@login-turn/lock-holder";
import type { BrowserSession, SignInAssertion } from "@login/browser-session";
import { parseSignedInWhen } from "@signin-proof/assertion";
import { proofFromObservation } from "@signin-proof/proof";
import { planLogin } from "@login/login-plan";
import { parseJarContents } from "@jar/jar-contents";
import { earliestCookieExpiryMs } from "@freshness/cookie-expiry";
import { earliestTokenExpiryMs } from "@freshness/token-expiry";
import { decideFreshness } from "@freshness/freshness-verdict";
import type { EnsureRequest } from "@ensure/ensure-plan";
import { planEnsure } from "@ensure/ensure-plan";
import { ExitCode } from "@verdict/exit-code";
import type { Result } from "@verdict/result";

export type EnsureWorld = {
  jarStore: JarStore;
  lockHolder: LockHolder;
  clock: Clock;
  openBrowserSession: (headed: boolean) => BrowserSession;
};

export type EnsureInput = {
  request: EnsureRequest;
  entry: CredentialsEntry;
  entryName: string;
  app: string;
  namespace: string | null;
  statePath: string;
  lockDir: string;
  headed: boolean;
  timeoutMs: number;
  lockWaitMs: number;
  version: string;
};

const baseResult = (input: EnsureInput): Result => ({
  tool: "authstate",
  version: input.version,
  command: "ensure",
  ok: false,
  status: "refused",
  reason: null,
  app: input.app,
  account: input.entryName,
  namespace: input.namespace,
  path: null,
  expires_at: null,
  seconds_remaining: null,
  expiry_source: "none",
  logged_in: null,
  proof: null,
  verified: false,
  browser_launched: false,
  exit_code: ExitCode.toolCouldNotRun,
});

const jarFacts = async (jarStore: JarStore, statePath: string, nowMs: number) => {
  const contents = await jarStore.read(statePath);
  let facts: { exists: boolean; freshness: "proven-dead" | "not-proven-dead" };
  if (contents === null) {
    facts = { exists: false, freshness: "proven-dead" };
  } else {
    const parsed = parseJarContents(contents);
    const cookieMs = earliestCookieExpiryMs(parsed.cookies);
    const tokenMs = earliestTokenExpiryMs(parsed.originTokens);
    const verdict = decideFreshness(cookieMs, tokenMs, nowMs);
    facts = { exists: true, freshness: verdict.verdict };
  }
  return facts;
};

const outcomeForFailedLogin = (
  observation: Awaited<ReturnType<BrowserSession["observe"]>>,
): Pick<Result, "reason" | "logged_in" | "proof" | "exit_code"> => {
  let outcome: Pick<Result, "reason" | "logged_in" | "proof" | "exit_code">;
  if (observation.kind === "observed") {
    outcome = { reason: "credentials-rejected", logged_in: false, proof: "assertion", exit_code: ExitCode.credentialsRejected };
  } else if (observation.kind === "timed-out") {
    outcome = { reason: "observation-timed-out", logged_in: null, proof: null, exit_code: ExitCode.toolCouldNotRun };
  } else {
    outcome = { reason: "browser-unavailable", logged_in: null, proof: null, exit_code: ExitCode.toolCouldNotRun };
  }
  return outcome;
};

const browserUnavailableOutcome = (result: Result, launched: boolean): Result => ({
  ...result,
  reason: "browser-unavailable",
  logged_in: null,
  proof: null,
  browser_launched: launched,
  exit_code: ExitCode.toolCouldNotRun,
});

const runLoginFlow = async (
  world: EnsureWorld,
  input: EnsureInput,
  assertion: SignInAssertion,
  result: Result,
): Promise<Result> => {
  const session = world.openBrowserSession(input.headed);
  let outcome = { ...result };
  let launched = false;
  try {
    await session.open();
    launched = true;
    await session.executeLogin(planLogin(input.entry), input.timeoutMs);
    const observation = await session.observe(assertion, input.timeoutMs);
    const proof = proofFromObservation(observation);
    if (proof === "signed-in") {
      const storageState = await session.captureStorageState();
      await world.jarStore.writeAtomic(input.statePath, storageState);
      outcome = {
        ...result,
        ok: true,
        status: "logged-in",
        path: input.statePath,
        logged_in: true,
        proof: "assertion",
        verified: true,
        browser_launched: true,
        exit_code: ExitCode.usable,
      };
    } else {
      outcome = { ...result, browser_launched: true, ...outcomeForFailedLogin(observation) };
    }
  } catch {
    outcome = browserUnavailableOutcome(result, launched);
  } finally {
    await session.close();
  }
  return outcome;
};

const runVerifyFlow = async (
  world: EnsureWorld,
  input: EnsureInput,
  assertion: SignInAssertion,
  result: Result,
): Promise<Result> => {
  const session = world.openBrowserSession(input.headed);
  let outcome: Result;
  let launched = false;
  try {
    await session.open(input.statePath);
    launched = true;
    await session.run(async (page) => {
      await page.goto(input.entry.app_url, { waitUntil: "load", timeout: input.timeoutMs });
    });
    const observation = await session.observe(assertion, input.timeoutMs);
    const proof = proofFromObservation(observation);
    if (proof === "signed-in") {
      const storageState = await session.captureStorageState();
      await world.jarStore.writeAtomic(input.statePath, storageState);
      outcome = {
        ...result,
        ok: true,
        status: "refreshed",
        path: input.statePath,
        logged_in: true,
        proof: "assertion",
        verified: true,
        browser_launched: true,
        exit_code: ExitCode.usable,
      };
    } else {
      outcome = await runLoginFlow(world, input, assertion, result);
    }
  } catch {
    outcome = browserUnavailableOutcome(result, launched);
  } finally {
    await session.close();
  }
  return outcome;
};

export const runEnsure = async (world: EnsureWorld, input: EnsureInput): Promise<Result> => {
  const result = baseResult(input);
  const assertionResult = parseSignedInWhen(input.entry.signed_in_when, input.entryName);
  let outcome: Result;

  if (!assertionResult.ok) {
    outcome = { ...result, reason: "assertion-missing", exit_code: ExitCode.credentialsFileInvalid };
  } else {
    const lockOutcome = await acquireLockTurn(world.lockHolder, world.clock, input.lockDir, input.lockWaitMs);
    if (lockOutcome === "timed-out") {
      outcome = { ...result, reason: "lock-timeout", exit_code: ExitCode.lockTimeout };
    } else {
      try {
        const facts = await jarFacts(world.jarStore, input.statePath, world.clock.now());
        const plan = planEnsure(input.request, true, facts);
        if (plan.kind === "reuse") {
          outcome = {
            ...result,
            ok: true,
            status: "reused",
            path: input.statePath,
            logged_in: null,
            proof: "not-proven-dead",
            exit_code: ExitCode.usable,
          };
        } else if (plan.kind === "verify") {
          outcome = await runVerifyFlow(world, input, assertionResult.assertion, result);
        } else {
          outcome = await runLoginFlow(world, input, assertionResult.assertion, result);
        }
      } finally {
        await world.lockHolder.remove(input.lockDir);
      }
    }
  }
  return outcome;
};
