import type { ToolCalloutData } from "../shared/contracts";

/** The groups of cards a reader can choose to fold: tool cards by kind, and the thinking stream. */
export const COLLAPSE_KINDS = ["shell", "write", "edit", "read", "other", "thinking"] as const;
export type CollapseKind = (typeof COLLAPSE_KINDS)[number];

export const COLLAPSE_KIND_LABELS: Record<CollapseKind, string> = {
  shell: "Shell and Git",
  write: "Writes",
  edit: "Edits",
  read: "Reads",
  other: "Other tools",
  thinking: "Thinking",
};

export function collapseKind(tool: string): CollapseKind {
  if (tool === "bash" || tool === "shell" || tool === "git") return "shell";
  if (tool === "write") return "write";
  if (tool === "edit") return "edit";
  if (tool === "read") return "read";
  return "other";
}

export function sanitizeCollapseKinds(value: unknown, fallback: CollapseKind[]): CollapseKind[] {
  if (!Array.isArray(value)) return fallback;
  return COLLAPSE_KINDS.filter((kind) => value.includes(kind));
}

function countLines(text: string | undefined): number {
  const trimmed = text?.replace(/\s+$/, "");
  return trimmed ? trimmed.split(/\r?\n/).length : 0;
}

/** Lines the card would show if opened: its command output, code and diff together. */
export function cardLineCount(data: ToolCalloutData): number {
  return (
    countLines(data.shell?.stdout) +
    countLines(data.shell?.stderr) +
    countLines(data.output) +
    countLines(data.code) +
    countLines(data.diff)
  );
}

/** What decides whether a finished card folds. Absent means folding is off. */
export interface AutoCollapseRules {
  kinds: readonly CollapseKind[];
  minLines: number;
}

/**
 * Whether a call that just finished should fold. An `ask` card holds the
 * question and its answer, so it never folds, and a failed call stays open so
 * the error is in view. A short card is not worth a click to reopen: with
 * `minLines` above zero it stays open until its content reaches that many lines.
 */
export function shouldAutoCollapse(
  data: ToolCalloutData,
  rules: AutoCollapseRules,
): boolean {
  if (data.tool === "ask" || data.status !== "completed") return false;
  if (!rules.kinds.includes(collapseKind(data.tool))) return false;
  return rules.minLines <= 0 || cardLineCount(data) >= rules.minLines;
}
