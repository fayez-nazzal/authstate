export type LockObservation =
  | { kind: "absent" }
  | { kind: "present"; ownerPid: number | null; ownerAlive: boolean | null };

export type LockAction = "take" | "wait" | "steal" | "give-up";

export const decideLockAction = (observation: LockObservation, deadlineReached: boolean): LockAction => {
  let action: LockAction;
  if (observation.kind === "absent") {
    action = "take";
  } else if (deadlineReached) {
    action = "give-up";
  } else if (observation.ownerAlive === false) {
    action = "steal";
  } else {
    action = "wait";
  }
  return action;
};
