import React from "react";
import { Pressable, Text, View } from "react-native";
import { Glyph } from "./glyph";
import { unselectable } from "./selection";
import { closeRun, openRun, useRunView } from "../card-runs";
import type { ExtendedThemeTokens } from "./theme-tokens";

interface RunBarProps {
  agentId: string;
  /** The key the card of this row reported to the run store. */
  cardKey: string;
  enabled: boolean;
  tokens: ExtendedThemeTokens;
}

/**
 * A bar over the first card of a run of consecutive cards: how many there are,
 * and one control that hides all the others or shows them again. The host draws
 * each card in a row of its own, so the bar cannot wrap them; the transformers
 * project the hidden ones to no row instead.
 */
export function RunBar({ agentId, cardKey, enabled, tokens }: RunBarProps) {
  const run = useRunView(agentId, cardKey);
  if (!enabled || !run?.leads) return null;
  const label = run.closed ? "Expand all" : "Collapse all";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 4,
        paddingBottom: 4,
      }}
    >
      <Text
        style={[
          { fontFamily: tokens.fontUi, fontSize: tokens.fs(11), color: tokens.foregroundMuted },
          unselectable,
        ]}
      >
        {run.count} steps
      </Text>
      <Pressable
        onPress={() => (run.closed ? openRun(cardKey) : closeRun(cardKey, run))}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 }}
      >
        <Glyph
          name={run.closed ? "ChevronDown" : "ChevronUp"}
          size={12}
          color={tokens.foregroundMuted}
        />
        <Text
          style={[
            { fontFamily: tokens.fontUi, fontSize: tokens.fs(11), color: tokens.foregroundMuted },
            unselectable,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
