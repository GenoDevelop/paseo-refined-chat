import type { AgentTimelineItem } from "@getpaseo/protocol/agent-types";
import { parsePlan, planTitle, isPlanImplementation } from "./plan";
import { isAskTool, isAskReply, parseCodexQuestionMetadata, parseAskQuestions, applyAnswers } from "./ask-question";
import { extractToolText } from "./tool-text";

export interface OutlineRow {
  item: AgentTimelineItem;
  timestamp: string;
  seqStart: number;
  seqEnd: number;
}
export interface OutlineEntry {
  id: string;
  seq: number;
  kind: "Prompt" | "Question" | "Plan" | "Error";
  title: string;
  body: string;
  timestamp: string;
  callId?: string;
  messageId?: string;
  status?: string;
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === "string" ? value : "";
const summary = (value: string) => value.trim().split(/\r?\n/)[0] || "Untitled";

/** Latest lifecycle record per call, preserving its original place in history. */
export function outlineEntries(rows: readonly OutlineRow[]): OutlineEntry[] {
  const calls = new Map<string, OutlineRow>();
  const ordered = [...rows].sort((a, b) => a.seqEnd - b.seqEnd);
  for (const row of ordered) {
    if (row.item.type === "tool_call" && row.item.callId) calls.set(row.item.callId, row);
  }
  const plans = [...calls.values()].flatMap(row => {
    const item = row.item;
    if (item.type !== "tool_call") return [];
    const plan = parsePlan(item.name, record(item.detail), item.metadata, item.status);
    return plan ? [plan] : [];
  });
  const answerTranscripts = [...calls.values()].flatMap(row => {
    const item = row.item;
    return item.type === "tool_call" && isAskTool(item.name) ? [text(record(item.detail).text)] : [];
  });
  const seen = new Set<string>();
  return ordered.flatMap((row): OutlineEntry[] => {
    let item = row.item;
    if (item.type === "tool_call" && item.callId) {
      if (seen.has(item.callId)) return [];
      seen.add(item.callId);
      item = calls.get(item.callId)!.item;
    }
    const base = { id: `entry:${row.seqStart}`, seq: row.seqStart, timestamp: row.timestamp };
    if (item.type === "user_message") {
      if (plans.some(plan => isPlanImplementation(item.text, plan))
        || answerTranscripts.some(transcript => isAskReply(item.text, transcript))) return [];
      if (!item.text.trim()) return [];
      return [{ ...base, kind: "Prompt" as const, title: summary(item.text), body: item.text, messageId: item.messageId }];
    }
    if (item.type === "error") {
      const body = text(record(item).message) || text(record(item).error) || "Agent error";
      return [{ ...base, kind: "Error" as const, title: summary(body), body }];
    }
    if (item.type !== "tool_call") return [];
    const detail = record(item.detail);
    const plan = parsePlan(item.name, detail, item.metadata, item.status);
    const tool = { ...base, callId: item.callId };
    if (plan) return [{ ...tool, kind: "Plan" as const, title: planTitle(plan.text), body: plan.text, status: plan.decision }];
    if (isAskTool(item.name)) {
      const questions = parseCodexQuestionMetadata(item.metadata);
      const output = detail.output ?? detail.result;
      const parsed = questions.length ? questions : applyAnswers(
        parseAskQuestions(record(detail.input ?? detail.arguments ?? detail.args)),
        [detail, output], typeof output === "string" ? output : extractToolText(output),
      );
      const body = parsed.length ? parsed.map(q => [
        `### ${q.question}`, ...q.options.map(option => `- ${option.label}${option.description ? ` — ${option.description}` : ""}`),
        ...(q.answers.length ? [`\n**Answer:** ${q.answers.join(", ")}`] : []),
      ].join("\n")).join("\n\n") : text(detail.text) || text(detail.output) || "Question details unavailable.";
      return [{ ...tool, kind: "Question" as const, title: parsed[0]?.question || summary(body), body }];
    }
    if (item.status === "failed") {
      const body = text(item.error) || text(detail.output) || text(detail.text) || `${item.name} failed`;
      return [{ ...tool, kind: "Error" as const, title: `${item.name}: ${summary(body)}`, body }];
    }
    return [];
  });
}
