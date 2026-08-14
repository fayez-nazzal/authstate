import { expect, test } from "bun:test";
import { runEnsure } from "@ensure/ensure-run";
import type { EnsureWorld, EnsureInput } from "@ensure/ensure-run";
import type { JarStore } from "@jar/jar-store";
import type { Clock, LockHolder } from "@login-turn/lock-holder";
import type { BrowserSession, Observation } from "@login/browser-session";

const entry = {
  email: "a@example.com",
  password: "not-a-real-secret",
  app_url: "https://example.test/app",
  signed_in_when: { url_matches: "https://example.test/app/**" },
};

const baseInput: EnsureInput = {
  request: { force: false, verify: false },
  entry,
  entryName: "basic-user",
  app: "example-app",
  namespace: null,
  statePath: "/fake/example-app--basic-user.json",
  lockDir: "/fake/example-app--basic-user.json.lock",
  headed: false,
  timeoutMs: 1000,
  lockWaitMs: 1000,
  version: "0.2.0",
};

const fakeLockHolder = (): LockHolder => ({
  tryCreate: async () => true,
  owner: async () => ({ pid: null, ageMs: 0 }),
  remove: async () => {},
  isPidAlive: () => false,
});

const fakeClock = (): Clock => ({
  now: () => 1_000_000_000_000,
  sleep: async () => {},
});

const fakeJarStore = (contents: string | null): { store: JarStore; writes: number } => {
  const state = { writes: 0 };
  const store: JarStore = {
    read: async () => contents,
    writeAtomic: async () => {
      state.writes += 1;
    },
    exists: async () => contents !== null,
    remove: async () => {},
    list: async () => [],
    modes: () => ({ file: 0o600, dir: 0o700 }),
  };
  return { store, writes: state.writes };
};

const throwingBrowserSession = (): BrowserSession => ({
  open: async () => {
    throw new Error("BrowserSession must never be constructed for a reuse plan");
  },
  run: async () => {},
  executeLogin: async () => {},
  observe: async () => {
    throw new Error("never reached");
  },
  captureStorageState: async () => "",
  close: async () => {},
  channel: () => "chrome",
});

test("a fresh jar reuses without ever constructing a BrowserSession", async () => {
  const oneHourFromNow = Math.floor(Date.now() / 1000) + 3600;
  const jar = fakeJarStore(JSON.stringify({ cookies: [{ name: "s", expires: oneHourFromNow }], origins: [] }));
  const world: EnsureWorld = {
    jarStore: jar.store,
    lockHolder: fakeLockHolder(),
    clock: fakeClock(),
    openBrowserSession: () => throwingBrowserSession(),
  };
  const result = await runEnsure(world, baseInput);
  expect(result.status).toBe("reused");
  expect(result.browser_launched).toBe(false);
  expect(result.exit_code).toBe(0);
});

test("a timed-out observation during login refuses, exits 7, and never writes a jar", async () => {
  const jar = fakeJarStore(null);
  let writeAtomicCalls = 0;
  jar.store.writeAtomic = async () => {
    writeAtomicCalls += 1;
  };
  const timedOutObservation: Observation = { kind: "timed-out", waitedMs: 20000 };
  const session: BrowserSession = {
    open: async () => {},
    run: async () => {},
    executeLogin: async () => {},
    observe: async () => timedOutObservation,
    captureStorageState: async () => {
      throw new Error("must never capture on a timed-out observation");
    },
    close: async () => {},
    channel: () => "chrome",
  };
  const world: EnsureWorld = {
    jarStore: jar.store,
    lockHolder: fakeLockHolder(),
    clock: fakeClock(),
    openBrowserSession: () => session,
  };
  const result = await runEnsure(world, baseInput);

  expect(result.exit_code).toBe(7);
  expect(result.status).toBe("refused");
  expect(result.reason).toBe("observation-timed-out");
  expect(result.ok).toBe(false);
  expect(writeAtomicCalls).toBe(0);
});

test("a lock that never terminates ends at the deadline with exit 5", async () => {
  const jar = fakeJarStore(null);
  const lockHolder: LockHolder = {
    tryCreate: async () => false,
    owner: async () => {
      throw new Error("unreadable");
    },
    remove: async () => {},
    isPidAlive: () => {
      throw new Error("never reached");
    },
  };
  let now = 0;
  const clock: Clock = {
    now: () => now,
    sleep: async () => {
      now += 2000;
    },
  };
  const world: EnsureWorld = {
    jarStore: jar.store,
    lockHolder,
    clock,
    openBrowserSession: () => throwingBrowserSession(),
  };
  const result = await runEnsure(world, { ...baseInput, lockWaitMs: 4000 });

  expect(result.exit_code).toBe(5);
  expect(result.reason).toBe("lock-timeout");
});
