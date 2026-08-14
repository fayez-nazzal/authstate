import type { Result } from "@verdict/result";

export const writeHumanReport = (result: Result): void => {
  const lines: string[] = [];
  lines.push(`authstate ${result.command}: ${result.status}`);
  if (result.path) {
    lines.push(`jar: ${result.path}`);
  }
  if (result.reason) {
    lines.push(`reason: ${result.reason}`);
  }
  for (const line of lines) {
    console.error(line);
  }
};
