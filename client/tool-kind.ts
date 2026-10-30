import type { ToolCallKind } from "../shared/contracts";

/**
 * Tools that run a command line, by the lowercase name a provider gives them.
 * Providers disagree on the spelling (`Bash`, `PowerShell`, `exec_command`), so
 * the card must not depend on one of them.
 */
const POSIX_SHELLS = new Set(["bash", "sh", "zsh", "fish"]);
const OTHER_SHELLS = new Set([
  "shell",
  "powershell",
  "pwsh",
  "cmd",
  "terminal",
  "local_shell",
  "exec_command",
  "run_command",
  "run_shell_command",
  "execute_command",
]);

/**
 * The card kind for a command-line tool, or undefined when the call is not
 * one. `bash` keeps the original label for the POSIX shells; every other
 * shell, PowerShell included, is drawn as `shell` rather than as a bash.
 */
export function classifyShellTool(
  rawName: string,
  detailType: string,
): Extract<ToolCallKind, "bash" | "shell"> | undefined {
  const name = rawName.trim().toLowerCase();
  if (POSIX_SHELLS.has(name)) return "bash";
  if (OTHER_SHELLS.has(name) || detailType === "shell") return "shell";
  return undefined;
}
