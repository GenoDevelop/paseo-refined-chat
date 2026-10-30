import React, { useMemo } from "react";
import { Text, View } from "react-native";
import type { TextStyle } from "react-native";
import { planFold, useFold } from "../fold";
import { FoldBar } from "./fold-bar";
import { renderTerminalOutput } from "./syntax-highlight";
import { selectionCodeText } from "./selection-actions";
import type { ExtendedThemeTokens } from "./theme-tokens";

interface FoldedOutputProps {
  text: string;
  /** Lines kept visible; zero draws the whole output. */
  limit: number;
  tokens: ExtendedThemeTokens;
  textStyle: TextStyle | TextStyle[];
}

/**
 * Command output that folds to its start and its end. The middle of a long
 * output is rarely what the reader came for, and the end is where the error and
 * the summary are, so both ends stay and the middle sits behind one control.
 */
export function FoldedOutput({ text, limit, tokens, textStyle }: FoldedOutputProps) {
  const trimmed = text.replace(/\s+$/, "");
  const lines = useMemo(() => trimmed.split("\n"), [trimmed]);
  const plan = useMemo(() => planFold(lines.length, limit, "headTail"), [lines.length, limit]);
  const { folded, open, setOpen } = useFold(trimmed, plan);

  if (!plan || !folded) {
    return (
      <View>
        <Text selectable {...selectionCodeText} style={textStyle}>
          {renderTerminalOutput(text, tokens)}
        </Text>
        {open ? (
          <FoldBar hidden={plan?.hidden ?? 0} open tokens={tokens} onPress={() => setOpen(false)} />
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <Text selectable {...selectionCodeText} style={textStyle}>
        {renderTerminalOutput(lines.slice(0, plan.head).join("\n"), tokens)}
      </Text>
      <FoldBar hidden={plan.hidden} open={false} tokens={tokens} onPress={() => setOpen(true)} />
      {plan.tail > 0 ? (
        <Text selectable {...selectionCodeText} style={textStyle}>
          {renderTerminalOutput(lines.slice(lines.length - plan.tail).join("\n"), tokens)}
        </Text>
      ) : null}
    </View>
  );
}
