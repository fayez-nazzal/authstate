import { parseArgs } from "node:util";
import { ExitCode } from "@verdict/exit-code";

export type Command = "ensure" | "login" | "path" | "revoke" | "prune";

export type Request = {
  command: Command;
  credentials: string;
  purpose?: string;
  namespace?: string;
  force: boolean;
  verify: boolean;
  headed: boolean;
  timeoutMs: number;
};

export type RequestResult =
  | { ok: true; request: Request }
  | { ok: false; reason: string; exitCode: number; showHelp: boolean };

const isCommand = (value: string | undefined): value is Command =>
  value === "ensure" || value === "login" || value === "path" || value === "revoke" || value === "prune";

export const parseRequest = (argv: string[]): RequestResult => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      credentials: { type: "string" },
      purpose: { type: "string" },
      namespace: { type: "string" },
      force: { type: "boolean", default: false },
      verify: { type: "boolean", default: false },
      headed: { type: "boolean", default: false },
      timeout: { type: "string", default: "20000" },
      out: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const command = positionals[0];
  let result: RequestResult;

  if (values.help) {
    result = { ok: false, reason: "help requested", exitCode: ExitCode.usable, showHelp: true };
  } else if (!isCommand(command)) {
    result = { ok: false, reason: `unknown command "${command || ""}"`, exitCode: ExitCode.usageError, showHelp: true };
  } else if (values.out) {
    result = {
      ok: false,
      reason: "--out was removed, use --namespace for a second session on one account",
      exitCode: ExitCode.usageError,
      showHelp: false,
    };
  } else if (values.headed && command !== "login") {
    result = {
      ok: false,
      reason: "--headed is only valid on `authstate login`",
      exitCode: ExitCode.usageError,
      showHelp: false,
    };
  } else if (!values.credentials) {
    result = { ok: false, reason: "--credentials is required", exitCode: ExitCode.usageError, showHelp: false };
  } else {
    result = {
      ok: true,
      request: {
        command,
        credentials: values.credentials as string,
        purpose: values.purpose as string | undefined,
        namespace: values.namespace as string | undefined,
        force: values.force as boolean,
        verify: values.verify as boolean,
        headed: values.headed as boolean,
        timeoutMs: Number(values.timeout),
      },
    };
  }
  return result;
};
