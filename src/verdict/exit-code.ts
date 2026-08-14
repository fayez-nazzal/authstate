export const ExitCode = {
  usable: 0,
  credentialsRejected: 1,
  usageError: 2,
  credentialsFileInvalid: 3,
  entryNotFound: 4,
  lockTimeout: 5,
  humanStepRequired: 6,
  toolCouldNotRun: 7,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

export type ReasonCode =
  | "credentials-rejected"
  | "assertion-missing"
  | "entry-ambiguous"
  | "entry-not-found"
  | "lock-timeout"
  | "human-step-required"
  | "browser-unavailable"
  | "observation-timed-out"
  | "credentials-file-invalid"
  | "usage-error";

export const REASON_EXIT_CODE: Record<ReasonCode, ExitCode> = {
  "credentials-rejected": ExitCode.credentialsRejected,
  "assertion-missing": ExitCode.credentialsFileInvalid,
  "entry-ambiguous": ExitCode.entryNotFound,
  "entry-not-found": ExitCode.entryNotFound,
  "lock-timeout": ExitCode.lockTimeout,
  "human-step-required": ExitCode.humanStepRequired,
  "browser-unavailable": ExitCode.toolCouldNotRun,
  "observation-timed-out": ExitCode.toolCouldNotRun,
  "credentials-file-invalid": ExitCode.credentialsFileInvalid,
  "usage-error": ExitCode.usageError,
};
