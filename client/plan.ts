import type { PlanData } from "../shared/contracts";

export function planTitle(text: string): string {
  return /^ {0,3}#{1,6}\s+(.+)$/m.exec(text)?.[1]?.replace(/\s+#+\s*$/, "").trim() || "Implementation plan";
}

export const PLAN_PROMPT_PREFIX = "The user approved the plan. Implement it now. Do not restate or revise the plan unless blocked.";
export function isPlanImplementation(message: string, plan: PlanData): boolean {
  if (plan.decision !== "approved") return false;
  const expected = `${PLAN_PROMPT_PREFIX}\n\nApproved plan:\n\n${plan.text.trim()}\n\nCarry out the work, make the necessary code changes, and verify the result.`;
  return message.replace(/\r\n/g, "\n").trim() === expected.replace(/\r\n/g, "\n");
}

/** Plans already persist in Paseo's timeline, including approval outcomes. */
export function parsePlan(name: string, detail: Record<string, unknown>, metadata: Record<string, unknown> | undefined, status: string): PlanData | undefined {
  const tool = name.toLowerCase();
  if ((tool !== "plan" && tool !== "plan_approval" && tool !== "exitplanmode") || detail.type !== "plan"
    || typeof detail.text !== "string" || !detail.text.trim()) return undefined;
  const decision = tool === "plan" ? "proposed" : status === "canceled" ? "canceled"
    : metadata?.approved === true ? "approved" : metadata?.approved === false ? "rejected"
      : status === "running" ? "pending" : "proposed";
  return { text: detail.text, decision };
}
