import { expect, test } from "bun:test";
import { acquireLockTurn } from "@login-turn/lock-holder";
import type { Clock, LockHolder } from "@login-turn/lock-holder";

test("a LockHolder that always fails terminates at the deadline with a counted sleep per iteration", async () => {
  const holder: LockHolder = {
    tryCreate: async () => false,
    owner: async () => {
      throw new Error("owner file unreadable");
    },
    remove: async () => {},
    isPidAlive: () => {
      throw new Error("should never be called when owner is unreadable");
    },
  };

  let now = 0;
  let sleepCalls = 0;
  const clock: Clock = {
    now: () => now,
    sleep: async (ms) => {
      sleepCalls += 1;
      now += ms;
    },
  };

  const outcome = await acquireLockTurn(holder, clock, "/fake/lock", 10000);

  expect(outcome).toBe("timed-out");
  expect(sleepCalls).toBeGreaterThan(0);
  expect(now).toBeGreaterThanOrEqual(10000);
});

test("owner pid alive at 600s age waits instead of stealing", async () => {
  const holder: LockHolder = {
    tryCreate: async () => false,
    owner: async () => ({ pid: 999, ageMs: 600000 }),
    remove: async () => {
      throw new Error("must not steal a lock held by a live pid");
    },
    isPidAlive: () => true,
  };
  let now = 0;
  const clock: Clock = {
    now: () => now,
    sleep: async () => {
      now += 2000;
    },
  };
  const outcomePromise = acquireLockTurn(holder, clock, "/fake/lock", 4000);
  const outcome = await outcomePromise;
  expect(outcome).toBe("timed-out");
});

test("owner pid dead at 5s age steals the lock", async () => {
  let removed = false;
  const holder: LockHolder = {
    tryCreate: async () => removed,
    owner: async () => ({ pid: 999, ageMs: 5000 }),
    remove: async () => {
      removed = true;
    },
    isPidAlive: () => false,
  };
  let now = 0;
  const clock: Clock = {
    now: () => now,
    sleep: async () => {
      now += 0;
    },
  };
  const outcome = await acquireLockTurn(holder, clock, "/fake/lock", 4000);
  expect(outcome).toBe("acquired");
});
