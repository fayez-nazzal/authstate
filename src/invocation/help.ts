import { ExitCode } from "@verdict/exit-code";
import packageJson from "../../package.json";

export const EXIT_TABLE: Array<{ code: number; meaning: string }> = [
  { code: ExitCode.usable, meaning: "usable" },
  { code: ExitCode.credentialsRejected, meaning: "credentials rejected" },
  { code: ExitCode.usageError, meaning: "usage error" },
  { code: ExitCode.credentialsFileInvalid, meaning: "credentials file invalid or assertion missing" },
  { code: ExitCode.entryNotFound, meaning: "no entry matches / ambiguous" },
  { code: ExitCode.lockTimeout, meaning: "lock timeout" },
  { code: ExitCode.humanStepRequired, meaning: "human step required" },
  { code: ExitCode.toolCouldNotRun, meaning: "tool could not run" },
];

const exitTableLine = () => EXIT_TABLE.map((row) => `${row.code} ${row.meaning}`).join(" · ");

export const VERSION = packageJson.version;

export const HELP_TEXT = `authstate ${VERSION} — the only thing that logs in, one jar per account

USAGE
  authstate ensure --credentials <yaml> [--purpose <name>]
  authstate login  --credentials <yaml> [--purpose <name>] --headed
  authstate path   --credentials <yaml> [--purpose <name>]
  authstate revoke --credentials <yaml> [--purpose <name>]
  authstate prune  --credentials <yaml>

  ensure guarantees a valid Playwright storageState jar for one account and
  prints its path on stdout. A jar the expiry maths has not proven dead is
  reused without opening a browser. Missing or expired state triggers
  exactly one headless scripted login. An entry with no password needs a
  human and refuses instead, pointing at "authstate login --headed".
  Parallel callers collapse into one login through a per jar lockfile.

  login always opens a browser and performs one scripted or human-assisted
  login, headed by default, and writes the resulting jar.

  path prints where that jar lives without touching the network, so a tool
  can resolve the jar before deciding to do anything.

  revoke deletes one account's jar and lock. prune deletes every jar under
  an app's credentials file that the expiry maths already proves dead.

OPTIONS
  --credentials <path>  .testing-credentials.yaml (schema: optional app name,
                        default entry name, and a credentials map of entries
                        with purpose, email, password, app_url, signed_in_when)
  --purpose <name>      credentials entry key, or a substring of its purpose
                        text. Falls back to the file's default entry
  --namespace <name>    extra key segment for a second, separate session on the
                        same account
  --force               skip the freshness check and re-login now
  --verify              also open a browser to confirm a jar the expiry
                        maths already calls fresh, instead of trusting it
  --headed              visible browser window. Valid only on the login command
  --timeout <ms>        per step timeout (default 20000)
  -h, --help            this help

EXIT CODES
  ${exitTableLine()}
`;
