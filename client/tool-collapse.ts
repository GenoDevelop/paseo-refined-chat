import type { ToolCalloutData } from "../shared/contracts";

/** The groups of cards a reader can choose to fold: tool cards by kind, and the thinking stream. */
export const COLLAPSE_KINDS = ["shell", "write", "edit", "read", "ask", "other", "thinking"] as const;
export type CollapseKind = (typeof COLLAPSE_KINDS)[number];

export const COLLAPSE_KIND_LABELS: Record<CollapseKind, string> = {
  shell: "Shell and Git",
  write: "Writes",
  edit: "Edits",
  read: "Reads",
  ask: "Questions (ask)",
  other: "Other tools",
  thinking: "Thinking",
};

export function collapseKind(tool: string): CollapseKind {
  if (tool === "bash" || tool === "shell" || tool === "git") return "shell";
  if (tool === "write") return "write";
  if (tool === "edit") return "edit";
  if (tool === "read") return "read";
  if (tool === "ask") return "ask";
  return "other";
}

export function sanitizeCollapseKinds(value: unknown, fallback: CollapseKind[]): CollapseKind[] {
  if (!Array.isArray(value)) return fallback;
  return COLLAPSE_KINDS.filter((kind) => value.includes(kind));
}

/** Questions remain readable when a completed card remounts after grouping. */
export function startsExpanded(data: ToolCalloutData, startCollapsed: readonly CollapseKind[]): boolean {
  if (startCollapsed.includes(collapseKind(data.tool))) return false;
  return data.tool === "ask" || data.status === "running" || data.status === "failed";
}

function countLines(text: string | undefined): number {
  const trimmed = text?.replace(/\s+$/, "");
  return trimmed ? trimmed.split(/\r?\n/).length : 0;
}

/** Lines the card would show if opened: its command output, code and diff together. */
export function cardLineCount(data: ToolCalloutData): number {
  if (data.tool === "ask" && data.askQuestions?.length) {
    return data.askQuestions.reduce((total, question) => total + countLines(question.question)
      + question.options.reduce((lines, option) => lines + countLines(option.label) + countLines(option.description), 0)
      + question.answers.reduce((lines, answer) => lines + countLines(answer), 0), 0);
  }
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

export function hasAskAnswers(data: ToolCalloutData): boolean {
  return Boolean(data.askQuestions?.length && data.askQuestions.every(question => question.answers.length > 0));
}

/**
 * Whether a call that just finished should fold. A question awaiting an answer
 * and a failed call stay open. A short card is not worth a click to reopen: with
 * `minLines` above zero it stays open until its content reaches that many lines.
 */
export function shouldAutoCollapse(
  data: ToolCalloutData,
  rules: AutoCollapseRules,
): boolean {
  if (data.status !== "completed") return false;
  if (data.tool === "ask" && !hasAskAnswers(data)) return false;
  if (!rules.kinds.includes(collapseKind(data.tool))) return false;
  return rules.minLines <= 0 || cardLineCount(data) >= rules.minLines;
}
