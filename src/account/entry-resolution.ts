import type { CredentialsEntry, CredentialsFile } from "@account/app-key";

export type EntryResolution =
  | { ok: true; name: string; entry: CredentialsEntry }
  | { ok: false; reason: string };

const matchingSubstringNames = (file: CredentialsFile, purpose: string): string[] => {
  const matches: string[] = [];
  for (const [name, entry] of Object.entries(file.credentials)) {
    const purposeText = entry.purpose || "";
    if (purposeText.toLowerCase().includes(purpose.toLowerCase())) {
      matches.push(name);
    }
  }
  return matches;
};

const resolveByPurpose = (file: CredentialsFile, purpose: string): EntryResolution => {
  let result: EntryResolution;
  if (file.credentials[purpose]) {
    result = { ok: true, name: purpose, entry: file.credentials[purpose] as CredentialsEntry };
  } else {
    const matches = matchingSubstringNames(file, purpose);
    if (matches.length === 0) {
      result = { ok: false, reason: `no credentials entry matches "${purpose}"` };
    } else if (matches.length > 1) {
      result = { ok: false, reason: `"${purpose}" matches more than one entry: ${matches.join(", ")}` };
    } else {
      const name = matches[0] as string;
      result = { ok: true, name, entry: file.credentials[name] as CredentialsEntry };
    }
  }
  return result;
};

export const resolveEntry = (file: CredentialsFile, purpose: string | undefined): EntryResolution => {
  let result: EntryResolution;
  if (purpose) {
    result = resolveByPurpose(file, purpose);
  } else if (file.default && file.credentials[file.default]) {
    result = { ok: true, name: file.default, entry: file.credentials[file.default] as CredentialsEntry };
  } else {
    result = { ok: false, reason: "no default credentials entry and no --purpose given" };
  }
  return result;
};
