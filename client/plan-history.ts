import { useEffect, useSyncExternalStore } from "react";
import { usePaseo } from "@getpaseo/plugin/client";
import type { PlanData } from "../shared/contracts";
import { isPlanImplementation, parsePlan, PLAN_PROMPT_PREFIX } from "./plan";

const plans = new Map<string, PlanData>();
const messages = new Map<string, { agentId: string; text: string }>();
const listeners = new Set<() => void>();
let revision = 0;
export const onPlanHistoryChange = (listener: () => void) => {
  listeners.add(listener); return () => { listeners.delete(listener); };
};
function changed() { revision++; listeners.forEach(listener => listener()); }
const snapshot = () => revision;
export function rememberPlan(agentId: string, callId: string, plan: PlanData): void {
  const key = `${agentId}:${callId}`;
  const previous = plans.get(key);
  if (previous?.text === plan.text && previous.decision === plan.decision) return;
  plans.set(key, plan);
  changed();
}
function matches(agentId: string, text: string): boolean {
  return [...plans].some(([key, plan]) => key.startsWith(`${agentId}:`) && isPlanImplementation(text, plan));
}
export function isHiddenPlanMessage(messageId: string | undefined, text: string): boolean {
  const message = messageId ? messages.get(messageId) : undefined;
  return message?.text === text && matches(message.agentId, text);
}
export function useHiddenPlanMessage(agentId: string, messageId: string | undefined, text: string, hasImages: boolean): boolean {
  const paseo = usePaseo();
  useSyncExternalStore(onPlanHistoryChange, snapshot, snapshot);
  const matched = !hasImages && Boolean(messageId) && matches(agentId, text);
  useEffect(() => {
    if (!messageId || !matched || messages.get(messageId)?.text === text) return;
    messages.set(messageId, { agentId, text });
    changed();
  }, [agentId, messageId, text, matched]);
  useEffect(() => {
    if (hasImages || !messageId || matched || !text.startsWith(PLAN_PROMPT_PREFIX)) return;
    let active = true;
    // A collapsed group may never mount its plan card. Verify against this
    // agent's raw history before hiding the host-generated implementation prompt.
    paseo.agents.ref(agentId).timeline.refetch({ direction: "tail", limit: 100 }).then(page => {
      if (!active) return;
      for (const { item } of page.entries) {
        if (item.type !== "tool_call" || !item.detail) continue;
        const plan = parsePlan(item.name, item.detail as unknown as Record<string, unknown>, item.metadata, item.status);
        if (plan && isPlanImplementation(text, plan) && item.callId) rememberPlan(agentId, item.callId, plan);
      }
    }).catch(() => { /* Leave the message visible without a verified history match. */ });
    return () => { active = false; };
  }, [paseo, agentId, messageId, text, hasImages, matched]);
  return matched;
}
