import React from "react";
import { Pressable, Text } from "react-native";
import { Glyph } from "./glyph";
import { unselectable } from "./selection";
import type { ExtendedThemeTokens } from "./theme-tokens";

interface FoldBarProps {
  /** Lines the fold hides. */
  hidden: number;
  /** True once the reader has opened the block, so the bar offers to close it. */
  open: boolean;
  tokens: ExtendedThemeTokens;
  onPress(): void;
}

/** The control a folded block carries: how much is hidden, and a way to see it. */
export function FoldBar({ hidden, open, tokens, onPress }: FoldBarProps) {
  const label = open ? "Show less" : `Show ${hidden} more ${hidden === 1 ? "line" : "lines"}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 6,
      }}
    >
      <Glyph
        name={open ? "ChevronUp" : "ChevronDown"}
        size={12}
        color={tokens.foregroundMuted}
      />
      <Text
        style={[
          {
            fontFamily: tokens.fontUi,
            fontSize: tokens.fs(11),
            color: tokens.foregroundMuted,
          },
          unselectable,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
