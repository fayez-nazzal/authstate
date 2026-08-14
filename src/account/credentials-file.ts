import { readFileSync } from "node:fs";
import type { CredentialsEntry, CredentialsFile } from "@account/app-key";

export type CredentialsFileResult =
  | { ok: true; file: CredentialsFile }
  | { ok: false; reason: string };

const isEntry = (value: unknown): value is CredentialsEntry => {
  const entry = value as Partial<CredentialsEntry> | null;
  return (
    entry != null &&
    typeof entry === "object" &&
    typeof entry.email === "string" &&
    typeof entry.password === "string" &&
    typeof entry.app_url === "string"
  );
};

const invalidEntryNames = (credentialsMap: Record<string, unknown>): string[] => {
  const invalidNames: string[] = [];
  for (const [name, entry] of Object.entries(credentialsMap)) {
    if (!isEntry(entry)) {
      invalidNames.push(name);
    }
  }
  return invalidNames;
};

const validateParsed = (path: string, parsed: unknown): CredentialsFileResult => {
  const file = parsed as Partial<CredentialsFile> | null;
  const credentialsMap = file?.credentials as Record<string, unknown> | undefined;
  let result: CredentialsFileResult;
  if (file == null || typeof file !== "object") {
    result = { ok: false, reason: `${path}: expected a YAML mapping at the top level` };
  } else if (credentialsMap == null || typeof credentialsMap !== "object" || Array.isArray(credentialsMap)) {
    result = { ok: false, reason: `${path}: "credentials" must be a map of entries` };
  } else {
    const invalidNames = invalidEntryNames(credentialsMap);
    if (invalidNames.length > 0) {
      result = { ok: false, reason: `${path}: entries missing email/password/app_url: ${invalidNames.join(", ")}` };
    } else {
      result = { ok: true, file: file as CredentialsFile };
    }
  }
  return result;
};

export const parseCredentialsFile = (path: string): CredentialsFileResult => {
  let result: CredentialsFileResult;
  try {
    const raw = Bun.YAML.parse(readFileSync(path, "utf8"));
    result = validateParsed(path, raw);
  } catch (error) {
    result = { ok: false, reason: `${path}: could not read or parse YAML (${error})` };
  }
  return result;
};
