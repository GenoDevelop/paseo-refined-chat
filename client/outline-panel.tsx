import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Platform } from "react-native";
import { usePaseo, type PluginAgentPanelProps } from "@getpaseo/plugin/client";
import type { PaseoAgentTimelineRefetchOptions } from "@getpaseo/client";
import { ScrollView } from "@getpaseo/plugin/client/react-native";
import { buildThemeTokens, withAlpha } from "./components/theme-tokens";
import { Glyph } from "./components/glyph";
import { hostFontEscape } from "./components/host-font-escape";
import { MarkdownView } from "./components/markdown/markdown-view";
import { SyntaxHighlightBlock } from "./components/syntax-highlight";
import { useEnhancerPreferences } from "./preferences";
import { outlineEntries, type OutlineRow, type OutlineEntry } from "./conversation-outline";
import { nativeOutlineJump } from "./native-outline-jump";
import { revealOutlineCard } from "./card-runs";
import { requestCardReveal, cancelCardReveal } from "./card-state";

export const OUTLINE_PANEL_ID = "conversation-outline";
const OUTLINE_KINDS = ["Prompt", "Question", "Plan", "Error"] as const;
interface History {
  rows: OutlineRow[];
  epoch: string;
  cursor: PaseoAgentTimelineRefetchOptions["cursor"];
  older: boolean;
}
const empty = (): History => ({ rows: [], epoch: "", cursor: undefined, older: false });

export function ConversationOutlinePanel({ params, theme, host }: PluginAgentPanelProps) {
  const agentId = params.agentId;
  const paseo = usePaseo();
  const handle = useMemo(() => paseo.agents.ref(agentId), [paseo, agentId]);
  const preferences = useEnhancerPreferences();
  const tokens = useMemo(() => buildThemeTokens(theme.colors, preferences), [theme.colors, preferences]);
  const [history, setHistory] = useState<History>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [enabledKinds, setEnabledKinds] = useState<OutlineEntry["kind"][]>(() => [...OUTLINE_KINDS]);
  const [selectedId, select] = useState<string | null>(null);
  const [jumpMessage, setJumpMessage] = useState("");
  const [jumping, setJumping] = useState(false);
  const jumpController = useRef<AbortController | null>(null);
  useEffect(() => {
    setJumping(false);
    return () => { jumpController.current?.abort(); jumpController.current = null; };
  }, [agentId, selectedId]);
  const jump = async (entry: OutlineEntry) => {
    jumpController.current?.abort();
    const controller = new AbortController();
    jumpController.current = controller;
    setJumpMessage("");
    const revealKey = entry.callId ? `${agentId}:${entry.callId}` : undefined;
    let requested = false;
    const reveal = () => {
      if (revealKey && !requested) { requested = true; requestCardReveal(revealKey); }
      revealOutlineCard(entry.callId);
    };
    reveal();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (controller.signal.aborted) { if (revealKey) cancelCardReveal(revealKey); return; }
    setJumping(true);
    const message = await nativeOutlineJump(host.id, agentId, history.epoch, entry, controller.signal, reveal);
    if (message && revealKey) cancelCardReveal(revealKey);
    if (jumpController.current === controller) {
      setJumpMessage(message ?? ""); setJumping(false);
    }
  };
  const generation = useRef(0);
  const busy = useRef(false);
  const load = useCallback(async (cursor?: PaseoAgentTimelineRefetchOptions["cursor"]) => {
    if (busy.current) return;
    busy.current = true;
    const ticket = generation.current;
    setLoading(true);
    setError("");
    try {
      const page = await handle.timeline.refetch({ direction: cursor ? "before" : "tail", cursor, limit: 100, projection: "canonical" });
      if (ticket !== generation.current) return;
      setHistory(previous => {
        const same = previous.epoch === page.epoch && !page.reset && !page.staleCursor;
        const rows = new Map((same ? previous.rows : []).map(row => [row.seqStart, row]));
        page.entries.forEach(row => rows.set(row.seqStart, row));
        const keepEarlier = same && !cursor && previous.cursor && page.startCursor && previous.cursor.seq < page.startCursor.seq;
        return { rows: [...rows.values()], epoch: page.epoch,
          cursor: keepEarlier ? previous.cursor : page.startCursor ?? undefined,
          older: keepEarlier ? previous.older : page.hasOlder };
      });
    } catch {
      if (ticket === generation.current) setError("History could not be loaded. Try Refresh.");
    } finally {
      if (ticket === generation.current) { busy.current = false; setLoading(false); }
    }
  }, [handle]);
  useEffect(() => {
    generation.current++;
    busy.current = false;
    setHistory(empty()); select(null); setQuery(""); setJumpMessage("");
    void load();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = handle.timeline.subscribe(() => {
      if (!timer) timer = setTimeout(() => { timer = undefined; void load(); }, 600);
    });
    subscription.ready.catch(() => { /* Manual refresh remains available offline. */ });
    return () => { generation.current++; clearTimeout(timer); subscription(); };
  }, [load, handle]);
  const entries = useMemo(() => outlineEntries(history.rows), [history.rows]);
  const selected = entries.find(entry => entry.id === selectedId);
  const searched = useMemo(() => entries.filter(entry => `${entry.title}\n${entry.body}`.toLowerCase().includes(query.toLowerCase())), [entries, query]);
  const counts = useMemo(() => {
    const result: Record<OutlineEntry["kind"], number> = { Prompt: 0, Question: 0, Plan: 0, Error: 0 };
    searched.forEach(entry => result[entry.kind]++);
    return result;
  }, [searched]);
  const filtered = useMemo(() => searched.filter(entry => enabledKinds.includes(entry.kind)).reverse(), [searched, enabledKinds]);
  const label = { color: tokens.foreground, fontFamily: tokens.fontUi, fontSize: tokens.fs(12) };
  const button = { color: tokens.accent, fontFamily: tokens.fontUi, fontSize: tokens.fs(12) };
  const looks: Record<OutlineEntry["kind"], { icon: string; color: string }> = {
    Prompt: { icon: "MessageSquare", color: tokens.isDark ? "#60a5fa" : "#1d4ed8" },
    Question: { icon: "HelpCircle", color: tokens.warning },
    Plan: { icon: "ListChecks", color: tokens.success },
    Error: { icon: "AlertCircle", color: tokens.danger },
  };
  const entryMeta = (entry: OutlineEntry) => {
    const look = looks[entry.kind];
    return <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 7, paddingVertical: 4,
        borderRadius: 5, backgroundColor: withAlpha(look.color, 0.14) }}>
        <Glyph name={look.icon} size={13} color={look.color} />
        <Text style={{ ...label, color: look.color, fontWeight: "600", fontSize: tokens.fs(11) }}>{entry.kind}</Text>
      </View>
      {entry.status && <Text style={{ ...label, color: tokens.foregroundMuted, fontSize: tokens.fs(10) }}>{entry.status}</Text>}
      <Text style={{ ...label, color: tokens.foregroundMuted, fontSize: tokens.fs(10) }}>{new Date(entry.timestamp).toLocaleString()}</Text>
    </View>;
  };
  return <View {...hostFontEscape} style={{ flex: 1, backgroundColor: tokens.surface0 }}>
    <View style={{ padding: 12, gap: 12, borderBottomWidth: 1, borderColor: tokens.borderSubtle }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        {selected ? <Pressable accessibilityRole="button" onPress={() => { jumpController.current?.abort(); select(null); setJumpMessage(""); }}><Text style={button}>← Outline</Text></Pressable>
          : <Text style={label}>{filtered.length} / {entries.length} entries · newest first</Text>}
        <Pressable accessibilityRole="button" disabled={loading} onPress={() => void load()}><Text style={button}>{loading ? "Loading…" : "Refresh"}</Text></Pressable>
      </View>
      {!selected && <TextInput accessibilityLabel="Search conversation outline" placeholder="Search loaded history…" placeholderTextColor={tokens.foregroundMuted}
        value={query} onChangeText={setQuery} style={{ ...label, padding: 8, borderWidth: 1, borderColor: tokens.border, borderRadius: 6 }} />}
      {!selected && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {OUTLINE_KINDS.map(kind => {
          const checked = enabledKinds.includes(kind);
          const look = looks[kind];
          const color = checked ? look.color : tokens.foregroundMuted;
          return <Pressable key={kind} accessibilityRole="checkbox" accessibilityLabel={`Show ${kind} entries (${counts[kind]})`}
            accessibilityState={{ checked }} onPress={() => setEnabledKinds(previous => previous.includes(kind)
              ? previous.filter(value => value !== kind) : [...previous, kind])}
            style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 7,
              borderRadius: 6, borderWidth: 1, borderColor: checked ? look.color : tokens.borderSubtle,
              backgroundColor: checked ? withAlpha(look.color, 0.14) : "transparent" }}>
            <Glyph name={look.icon} size={13} color={color} />
            <Text style={{ ...label, color, fontSize: tokens.fs(11), fontWeight: checked ? "600" : "400" }}>{kind}</Text>
            <Text style={{ ...label, color, fontSize: tokens.fs(10), fontWeight: "600", paddingHorizontal: 5, paddingVertical: 1,
              borderRadius: 4, backgroundColor: withAlpha(look.color, checked ? 0.16 : 0.06) }}>{counts[kind]}</Text>
            <Glyph name={checked ? "CheckCircle" : "Circle"} size={12} color={color} />
          </Pressable>;
        })}
      </View>}
      {error ? <Text accessibilityRole="alert" style={{ ...label, color: tokens.danger }}>{error}</Text> : null}
    </View>
    <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
      {selected ? <>
        {entryMeta(selected)}
        {Platform.OS === "web" && (selected.callId || selected.messageId) && <Pressable accessibilityRole="button" onPress={() => { if (jumping) jumpController.current?.abort(); else void jump(selected); }}>
          <Text style={button}>{jumping ? "Cancel jump" : "Find in chat"}</Text>
        </Pressable>}
        {jumpMessage ? <Text style={label}>{jumpMessage}</Text> : null}
        {selected.kind === "Error"
          ? <SyntaxHighlightBlock code={selected.body} tokens={tokens} compact />
          : <MarkdownView text={selected.body} tokens={tokens} variant={preferences.markdownVariant} marks={preferences.highlightMarks} />}
      </> : <>
        {!loading && !filtered.length && <Text style={label}>{!enabledKinds.length ? "Select at least one type to show entries."
          : query || enabledKinds.length !== OUTLINE_KINDS.length ? "No matches for the current search and type filters."
            : "No prompts, questions, plans or errors in this history page."}</Text>}
        {filtered.map(entry => <Pressable key={entry.id} accessibilityRole="button" onPress={() => { select(entry.id); setJumpMessage(""); }}
          style={{ padding: 12, gap: 9, borderWidth: 1, borderColor: tokens.borderSubtle, borderLeftWidth: 3,
            borderLeftColor: looks[entry.kind].color, backgroundColor: withAlpha(looks[entry.kind].color, 0.05), borderRadius: 8 }}>
          {entryMeta(entry)}
          <Text numberOfLines={3} style={{ ...label, fontSize: tokens.fs(13) }}>{entry.title}</Text>
        </Pressable>)}
        {history.older && <Pressable accessibilityRole="button" disabled={loading} onPress={() => void load(history.cursor)}><Text style={button}>Load earlier history</Text></Pressable>}
      </>}
    </ScrollView>
  </View>;
}
