import React, { useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import type { ExtendedThemeTokens } from "./components/theme-tokens";
import { SyntaxHighlightBlock } from "./components/syntax-highlight";
import { buildUnifiedDiffText } from "./components/diff-text";
import { useConversationHistory } from "./conversation-history";
import { outlineEntries } from "./conversation-outline";
import { planTitle } from "./plan";

export function PlanComparison({ agentId, callId, markdown, tokens }: {
  agentId: string; callId?: string; markdown: string; tokens: ExtendedThemeTokens;
}) {
  const { history, loading, error, load } = useConversationHistory(agentId);
  const [selectedId, select] = useState<string | null>(null);
  const candidates = useMemo(() => outlineEntries(history.rows)
    .filter(entry => entry.kind === "Plan" && (!callId || entry.callId !== callId)).reverse(), [history.rows, callId]);
  const selected = candidates.find(entry => entry.id === selectedId);
  const diff = useMemo(() => selected ? buildUnifiedDiffText(markdown, selected.body) : "", [markdown, selected]);
  const label = { color: tokens.foreground, fontFamily: tokens.fontUi, fontSize: tokens.fs(12) };
  const button = { ...label, color: tokens.accent };
  return <View style={{ padding: 12, gap: 12, borderWidth: 1, borderColor: tokens.borderSubtle, borderRadius: 8 }}>
    <Text style={{ ...label, fontWeight: "600" }}>Compare plans · Markdown changes</Text>
    <Text style={label}>From: {planTitle(markdown)}</Text>
    {selected ? <>
      <Text style={label}>To: {selected.title} · {new Date(selected.timestamp).toLocaleString()}</Text>
      <Text style={{ ...label, color: tokens.foregroundMuted }}>Red: removed from the open plan. Green: added in the selected plan.</Text>
      <Pressable accessibilityRole="button" onPress={() => select(null)}><Text style={button}>Choose another plan</Text></Pressable>
      {diff ? <SyntaxHighlightBlock code={diff} language="diff" tokens={tokens} showLineNumbers={false} compact />
        : <Text style={{ ...label, color: tokens.success }}>No Markdown differences.</Text>}
    </> : <>
      <Text style={{ ...label, color: tokens.foregroundMuted }}>Choose another plan from this conversation. Plans are not paired automatically.</Text>
      {candidates.map(entry => <Pressable key={entry.id} accessibilityRole="button" onPress={() => select(entry.id)}
        style={{ padding: 10, gap: 4, borderWidth: 1, borderColor: tokens.borderSubtle, borderRadius: 6 }}>
        <Text style={label}>{entry.title}</Text>
        <Text style={{ ...label, color: tokens.foregroundMuted, fontSize: tokens.fs(10) }}>{entry.status} · {new Date(entry.timestamp).toLocaleString()}</Text>
      </Pressable>)}
      {!loading && !candidates.length && <Text style={label}>{history.older ? "No other plans in the loaded history. Load earlier history to look further back." : "No other plans found in this conversation."}</Text>}
      {history.older && <Pressable accessibilityRole="button" disabled={loading} onPress={() => void load(history.cursor)}><Text style={button}>Load earlier history</Text></Pressable>}
    </>}
    {loading && <Text style={label}>Loading plans…</Text>}
    {error && <Text accessibilityRole="alert" style={{ ...label, color: tokens.danger }}>{error}</Text>}
    {error && <Pressable accessibilityRole="button" disabled={loading} onPress={() => void load()}><Text style={button}>Retry</Text></Pressable>}
  </View>;
}
