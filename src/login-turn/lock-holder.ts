import { decideLockAction } from "@login-turn/lock-decision";
import type { LockObservation } from "@login-turn/lock-decision";

export type Clock = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

export type LockHolder = {
  tryCreate: (dir: string, ownerPid: number) => Promise<boolean>;
  owner: (dir: string) => Promise<{ pid: number | null; ageMs: number }>;
  remove: (dir: string) => Promise<void>;
  isPidAlive: (pid: number) => boolean;
};

export const createFsLockHolder = (): LockHolder => {
  const tryCreate = async (dir: string, ownerPid: number): Promise<boolean> => {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    let created: boolean;
    try {
      mkdirSync(dir);
      writeFileSync(`${dir}/owner`, String(ownerPid));
      created = true;
    } catch {
      created = false;
    }
    return created;
  };

  const owner = async (dir: string): Promise<{ pid: number | null; ageMs: number }> => {
    const { readFileSync, statSync } = await import("node:fs");
    let pid: number | null = null;
    let ageMs = 0;
    try {
      const raw = readFileSync(`${dir}/owner`, "utf8").trim();
      pid = Number(raw);
      ageMs = Date.now() - statSync(dir).mtimeMs;
    } catch {
      pid = null;
    }
    return { pid, ageMs };
  };

  const remove = async (dir: string): Promise<void> => {
    const { rmSync } = await import("node:fs");
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {}
  };

  const isPidAlive = (pid: number): boolean => {
    let alive: boolean;
    try {
      process.kill(pid, 0);
      alive = true;
    } catch {
      alive = false;
    }
    return alive;
  };

  return { tryCreate, owner, remove, isPidAlive };
};

const observe = async (holder: LockHolder, dir: string) => {
  const created = await holder.tryCreate(dir, process.pid);
  let observation: LockObservation;
  if (created) {
    observation = { kind: "absent" };
  } else {
    let found: { pid: number | null; ageMs: number };
    try {
      found = await holder.owner(dir);
    } catch {
      found = { pid: null, ageMs: 0 };
    }
    let ownerAlive: boolean | null = null;
    if (found.pid != null) {
      ownerAlive = holder.isPidAlive(found.pid);
    }
    observation = { kind: "present", ownerPid: found.pid, ownerAlive };
  }
  return { created, observation };
};

export const acquireLockTurn = async (
  holder: LockHolder,
  clock: Clock,
  dir: string,
  waitMs: number,
): Promise<"acquired" | "timed-out"> => {
  const deadline = clock.now() + waitMs;
  let outcome: "acquired" | "timed-out" | null = null;
  while (outcome === null) {
    const { created, observation } = await observe(holder, dir);
    if (created) {
      outcome = "acquired";
    } else {
      const action = decideLockAction(observation, clock.now() >= deadline);
      if (action === "give-up") {
        outcome = "timed-out";
      } else if (action === "steal") {
        await holder.remove(dir);
        await clock.sleep(0);
      } else {
        await clock.sleep(2000);
      }
    }
  }
  return outcome;
};

export const createSystemClock = (): Clock => {
  const now = () => Date.now();
  const sleep = (ms: number) => Bun.sleep(ms);
  return { now, sleep };
};
