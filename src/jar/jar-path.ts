import { homedir } from "node:os";
import { normalizeAppKey } from "@account/app-key";

export function jarFileName(app: string, purpose: string, namespace?: string): string {
  let name = `${normalizeAppKey(app)}--${normalizeAppKey(purpose)}`;
  if (namespace != null && namespace !== "") {
    name = `${name}--${normalizeAppKey(namespace)}`;
  }
  return `${name}.json`;
}

export function canonicalJarPath(app: string, purpose: string, namespace?: string): string {
  return `${homedir()}/.authstate/${jarFileName(app, purpose, namespace)}`;
}
