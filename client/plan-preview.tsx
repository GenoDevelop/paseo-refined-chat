import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { View, Text, Pressable, Platform, Share } from "react-native";
import { ScrollView, copyText } from "@getpaseo/plugin/client/react-native";
import type { PluginClientContext, PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { MarkdownView } from "./components/markdown/markdown-view";
import { buildThemeTokens, type ExtendedThemeTokens } from "./components/theme-tokens";
import { hostFontEscape } from "./components/host-font-escape";
import { useEnhancerPreferences } from "./preferences";
import type { PlanData } from "../shared/contracts";
import { downloadPlanMarkdown, planExportFilename } from "./plan-export";
import { PlanComparison } from "./plan-comparison";

export const PLAN_PANEL_ID = "plan-preview";
let openPanel: PluginClientContext["openPanel"] | null = null;
const targets = new Map<string, { plan: PlanData; callId: string; agentId: string }>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function registerPlanPanelOpener(opener: PluginClientContext["openPanel"] | null): void {
  openPanel = opener;
  if (!opener) targets.clear();
}
export function openPlanPreview(workspaceId: string, callId: string, plan: PlanData, agentId: string): void {
  if (!openPanel) return;
  targets.set(workspaceId, { plan, callId, agentId });
  listeners.forEach(listener => listener());
  openPanel(PLAN_PANEL_ID, { workspaceId, location: "explorer" });
}

export function updatePlanPreview(workspaceId: string, callId: string, plan: PlanData, agentId: string): void {
  const previous = targets.get(workspaceId);
  if (!previous || previous.callId !== callId || previous.agentId !== agentId
    || (previous.plan.text === plan.text && previous.plan.decision === plan.decision)) return;
  targets.set(workspaceId, { ...previous, plan });
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
export function PlanContent({ plan, tokens, showStatus = true, agentId, callId }: { plan: PlanData; tokens: ExtendedThemeTokens; showStatus?: boolean; agentId?: string; callId?: string }) {
  const preferences = useEnhancerPreferences();
  return <View style={{ gap: 12 }}>
    {showStatus && <View style={{ alignItems: "flex-start" }}><PlanBadge plan={plan} tokens={tokens} /></View>}
    <PlanActions markdown={plan.text} tokens={tokens} agentId={agentId} callId={callId} />
    <MarkdownView text={plan.text} tokens={tokens} variant={preferences.markdownVariant} marks={preferences.highlightMarks} />
  </View>;
}

export function PlanActions({ markdown, tokens, agentId, callId }: { markdown: string; tokens: ExtendedThemeTokens; agentId?: string; callId?: string }) {
  const [busy, setBusy] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const operation = useRef(0);
  useEffect(() => {
    operation.current++;
    setFeedback(null); setBusy(false); setComparing(false);
    return () => { operation.current++; };
  }, [markdown, agentId, callId]);
  const act = async (copy: boolean) => {
    const ticket = ++operation.current;
    setBusy(true); setFeedback(null);
    try {
      let message = "";
      if (copy) { await copyText(markdown); message = "Markdown copied."; }
      else if (Platform.OS === "web") { downloadPlanMarkdown(markdown); message = "Download started."; }
      else {
        const result = await Share.share({ title: planExportFilename(markdown), message: markdown });
        if (result.action === Share.sharedAction) message = "Markdown shared.";
      }
      if (ticket === operation.current && message) setFeedback({ text: message, error: false });
    } catch {
      if (ticket === operation.current) setFeedback({ text: copy ? "Could not copy the plan. Please try again." : "Could not export the plan. Please try again.", error: true });
    } finally { if (ticket === operation.current) setBusy(false); }
  };
  const buttonStyle = { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: tokens.border, borderRadius: 6, opacity: busy ? 0.5 : 1 };
  const label = { color: tokens.accent, fontFamily: tokens.fontUi, fontSize: tokens.fs(12) };
  return <View style={{ gap: 7 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(true)} style={buttonStyle}><Text style={label}>Copy Markdown</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(false)} style={buttonStyle}><Text style={label}>{Platform.OS === "web" ? "Export .md" : "Share Markdown"}</Text></Pressable>
      {agentId && <Pressable accessibilityRole="button" accessibilityState={{ expanded: comparing }}
        onPress={() => setComparing(value => !value)} style={{ ...buttonStyle, opacity: 1 }}>
        <Text style={label}>{comparing ? "Close comparison" : "Compare with…"}</Text>
      </Pressable>}
    </View>
    {feedback && <Text accessibilityLiveRegion="polite" style={{ ...label, color: feedback.error ? tokens.danger : tokens.success }}>{feedback.text}</Text>}
    {comparing && agentId && <PlanComparison agentId={agentId} callId={callId} markdown={markdown} tokens={tokens} />}
  </View>;
}

export function PlanPreviewPanel({ theme, workspaceId }: PluginWorkspacePanelProps) {
  const preferences = useEnhancerPreferences();
  const tokens = useMemo(() => buildThemeTokens(theme.colors, preferences), [theme.colors, preferences]);
  const plan = useSyncExternalStore(subscribe, () => targets.get(workspaceId) ?? null, () => null);
  return <View {...hostFontEscape} style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {plan ? <PlanContent plan={plan.plan} agentId={plan.agentId} callId={plan.callId} tokens={tokens} /> :
        <Text style={{ color: tokens.foregroundMuted }}>Open a plan from the conversation to read it here.</Text>}
    </ScrollView>
  </View>;
}
