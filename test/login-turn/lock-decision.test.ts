import { expect, test } from "bun:test";
import { decideLockAction } from "@login-turn/lock-decision";
import type { LockObservation } from "@login-turn/lock-decision";

test("no lock on disk is always take, deadline or not", () => {
  const absent: LockObservation = { kind: "absent" };
  expect(decideLockAction(absent, false)).toBe("take");
  expect(decideLockAction(absent, true)).toBe("take");
});

test("deadline reached is always give-up once the lock exists", () => {
  const alive: LockObservation = { kind: "present", ownerPid: 123, ownerAlive: true };
  const dead: LockObservation = { kind: "present", ownerPid: 123, ownerAlive: false };
  const unknown: LockObservation = { kind: "present", ownerPid: null, ownerAlive: null };
  expect(decideLockAction(alive, true)).toBe("give-up");
  expect(decideLockAction(dead, true)).toBe("give-up");
  expect(decideLockAction(unknown, true)).toBe("give-up");
});

test("owner pid alive at any age is wait, never steal", () => {
  const observation: LockObservation = { kind: "present", ownerPid: 123, ownerAlive: true };
  expect(decideLockAction(observation, false)).toBe("wait");
});

test("owner pid dead is steal, regardless of lock age", () => {
  const observation: LockObservation = { kind: "present", ownerPid: 123, ownerAlive: false };
  expect(decideLockAction(observation, false)).toBe("steal");
});

test("owner unreadable before the deadline is wait, not steal", () => {
  const observation: LockObservation = { kind: "present", ownerPid: null, ownerAlive: null };
  expect(decideLockAction(observation, false)).toBe("wait");
});
