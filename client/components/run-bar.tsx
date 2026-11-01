import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { Glyph } from "./glyph";
import { unselectable } from "./selection";
import { applyCollapseRule, closeRun, openRun, useRunView } from "../card-runs";
import type { CardRunCollapsePreference } from "../preferences";
import type { CollapseKind } from "../tool-collapse";
import type { ExtendedThemeTokens } from "./theme-tokens";

interface RunBarProps {
  agentId: string;
  /** The key the card of this row reported to the run store. */
  cardKey: string;
  enabled: boolean;
  rule: CardRunCollapsePreference;
  /** Kinds whose failed cards do not keep a run open: they start collapsed. */
  startCollapsed: readonly CollapseKind[];
  tokens: ExtendedThemeTokens;
}

/**
 * A bar over the first card of a run of consecutive cards: what the cards did,
 * how they are doing, and one press that hides all the others or shows them
 * again. The host draws each card in a row of its own, so the bar cannot wrap
 * them; the transformers project the hidden ones to no row instead.
 */
export function RunBar({ agentId, cardKey, enabled, rule, startCollapsed, tokens }: RunBarProps) {
  const run = useRunView(agentId, cardKey);
  useEffect(() => {
    if (enabled && run?.leads) applyCollapseRule(cardKey, run, rule, startCollapsed);
  }, [enabled, run, cardKey, rule, startCollapsed]);
  if (!enabled || !run?.leads) return null;

  const status =
    run.failed > 0 ? `${run.failed} failed` : run.running ? "Working" : null;
  const statusColor = run.failed > 0 ? tokens.danger : tokens.foregroundMuted;
  return (
    <Pressable
      onPress={() => (run.closed ? openRun(cardKey) : closeRun(cardKey, run))}
      accessibilityRole="button"
      accessibilityLabel={`${run.summary}. ${run.closed ? "Show all" : "Hide all"}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginVertical: 4,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.surfaceGlass,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        <Glyph
          name={run.closed ? "ChevronRight" : "ChevronDown"}
          size={13}
          color={tokens.foregroundMuted}
        />
        <Text
          numberOfLines={1}
          style={[
            {
              fontFamily: tokens.fontUi,
              fontSize: tokens.fs(12),
              fontWeight: "600",
              color: tokens.foreground,
              flexShrink: 1,
            },
            unselectable,
          ]}
        >
          {run.summary}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {status ? (
          <Text
            style={[
              { fontFamily: tokens.fontUi, fontSize: tokens.fs(11), color: statusColor },
              unselectable,
            ]}
          >
            {status}
          </Text>
        ) : null}
        <Text
          style={[
            { fontFamily: tokens.fontUi, fontSize: tokens.fs(11), color: tokens.foregroundMuted },
            unselectable,
          ]}
        >
          {run.count} {run.count === 1 ? "step" : "steps"} · {run.closed ? "Expand" : "Collapse"}
        </Text>
      </View>
    </Pressable>
  );
}
