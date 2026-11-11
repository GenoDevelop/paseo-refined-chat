import React, { useMemo, useSyncExternalStore } from "react";
import { View, Text } from "react-native";
import { ScrollView } from "@getpaseo/plugin/client/react-native";
import type { PluginClientContext, PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { MarkdownView } from "./components/markdown/markdown-view";
import { buildThemeTokens, type ExtendedThemeTokens } from "./components/theme-tokens";
import { hostFontEscape } from "./components/host-font-escape";
import { useEnhancerPreferences } from "./preferences";
import type { PlanData } from "../shared/contracts";

export const PLAN_PANEL_ID = "plan-preview";
let openPanel: PluginClientContext["openPanel"] | null = null;
const targets = new Map<string, PlanData>();
const selected = new Map<string, string>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function registerPlanPanelOpener(opener: PluginClientContext["openPanel"] | null): void {
  openPanel = opener;
  if (!opener) { targets.clear(); selected.clear(); }
}
export function openPlanPreview(workspaceId: string, callId: string, plan: PlanData): void {
  if (!openPanel) return;
  selected.set(workspaceId, callId);
  targets.set(workspaceId, plan);
  listeners.forEach(listener => listener());
  openPanel(PLAN_PANEL_ID, { workspaceId, location: "explorer" });
}

export function updatePlanPreview(workspaceId: string, callId: string, plan: PlanData): void {
  const previous = targets.get(workspaceId);
  if (selected.get(workspaceId) !== callId || !previous
    || (previous.text === plan.text && previous.decision === plan.decision)) return;
  targets.set(workspaceId, plan);
  listeners.forEach(listener => listener());
}

const LABELS: Record<PlanData["decision"], string> = {
  proposed: "Proposed plan", pending: "Awaiting decision", approved: "Approved",
  rejected: "Rejected", canceled: "Canceled",
};
export function PlanBadge({ plan, tokens }: { plan: PlanData; tokens: ExtendedThemeTokens }) {
  const color = plan.decision === "approved" ? tokens.success : plan.decision === "rejected" ? tokens.danger : tokens.foregroundMuted;
  return <Text style={{ color, fontFamily: tokens.fontUi, fontSize: tokens.fs(11), paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: tokens.borderSubtle, borderRadius: 6 }}>{LABELS[plan.decision]}</Text>;
}
export function PlanContent({ plan, tokens, showStatus = true }: { plan: PlanData; tokens: ExtendedThemeTokens; showStatus?: boolean }) {
  const preferences = useEnhancerPreferences();
  return <View style={{ gap: 12 }}>
    {showStatus && <View style={{ alignItems: "flex-start" }}><PlanBadge plan={plan} tokens={tokens} /></View>}
    <MarkdownView text={plan.text} tokens={tokens} variant={preferences.markdownVariant} marks={preferences.highlightMarks} />
  </View>;
}

export function PlanPreviewPanel({ theme, workspaceId }: PluginWorkspacePanelProps) {
  const preferences = useEnhancerPreferences();
  const tokens = useMemo(() => buildThemeTokens(theme.colors, preferences), [theme.colors, preferences]);
  const plan = useSyncExternalStore(subscribe, () => targets.get(workspaceId) ?? null, () => null);
  return <View {...hostFontEscape} style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {plan ? <PlanContent plan={plan} tokens={tokens} /> :
        <Text style={{ color: tokens.foregroundMuted }}>Open a plan from the conversation to read it here.</Text>}
    </ScrollView>
  </View>;
}
