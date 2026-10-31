import React, { useMemo, useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import { copyText } from "@getpaseo/plugin/client/react-native";
import { Glyph } from "./glyph";
import { Pop } from "./motion";
import { formatMessageTime } from "./message-time";
import { radius } from "./theme-tokens";
import type { ExtendedThemeTokens } from "./theme-tokens";
import { selectableSurface } from "./selection";
import { selectionSurface } from "./selection-actions";
import { planFold, useFold } from "../fold";
import { FoldBar } from "./fold-bar";

export interface TurnUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  contextWindowUsedTokens?: number;
  contextWindowMaxTokens?: number;
}

/** Typical characters per row of a prompt, used only to decide whether to fold. */
const CHARS_PER_ROW = 70;

interface UserMessageProps {
  text: string;
  timestamp?: Date;
  /** Pasted or attached images, as anything `<Image>` accepts. */
  images?: string[];
  tokens: ExtendedThemeTokens;
  /** Absent until the turn reports usage, and absent entirely for turns this
   * client did not observe live — usage is not persisted on timeline items. */
  usage?: TurnUsage | null;
  /** True while the turn is still running, so the figures are still climbing. */
  pending?: boolean;
  /** Lines of the prompt shown before the rest folds; zero shows all. */
  maxLines?: number;
}

/**
 * Token counts run to six digits. One decimal is kept through the whole
 * thousands range: rounding 94,336 to `94k` hides the movement between turns,
 * which is the only reason to watch the number.
 */
function formatTokens(value: number): string {
  if (value < 1000) return String(value);
  // Rounding is done on integers: 97850 / 1000 is held as 97.8499…, so
  // `toFixed(1)` would report 97.8 for a value that is 97.9k.
  if (value < 1_000_000) return `${(Math.round(value / 100) / 10).toFixed(1)}k`;
  return `${(Math.round(value / 100_000) / 10).toFixed(1)}M`;
}

/** One labelled figure. A missing count is omitted, never shown as zero. */
function UsageFigure({
  label,
  value,
  styles,
}: {
  label: string;
  value?: number;
  styles: { usageKey: object; usageValue: object };
}) {
  if (typeof value !== "number") return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Text selectable style={styles.usageKey}>
        {label}
      </Text>
      <Text selectable style={styles.usageValue}>
        {formatTokens(value)}
      </Text>
    </View>
  );
}

/**
 * The user's turn. It sits to the right on light paper with dark text and no
 * accent: colour on this surface marks agent activity, so keeping it off the
 * prompt is what separates what the user wrote from what the agent did.
 * The body text stays left-aligned inside the block, because right-ragged
 * prose is harder to read once it wraps.
 */
export function UserMessage({
  text,
  timestamp,
  images,
  tokens,
  usage,
  pending = false,
  maxLines = 0,
}: UserMessageProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    // The host owns clipboard access. Reaching for navigator directly would
    // only work on web and would bypass its permission handling.
    copyText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  }, [text]);

  // A prompt with a pasted file would push the thread far apart, so a long one
  // keeps its first lines behind a control. Copy still takes the whole prompt.
  // A long paragraph has no line breaks, so each line counts as many rows as
  // it would wrap to; the clamp itself then counts the real wrapped rows.
  const estimatedRows = useMemo(
    () =>
      text
        .replace(/\s+$/, "")
        .split("\n")
        .reduce((rows, line) => rows + Math.max(1, Math.ceil(line.length / CHARS_PER_ROW)), 0),
    [text],
  );
  const plan = useMemo(() => planFold(estimatedRows, maxLines, "head"), [estimatedRows, maxLines]);
  const { folded, open, setOpen } = useFold(text, plan);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignSelf: "flex-end",
          maxWidth: "82%",
          flexDirection: "row",
          gap: 10,
          paddingVertical: 8,
          paddingLeft: 12,
          paddingRight: 10,
          borderRadius: radius.card,
          // The square tail marks the turn's owner, matching the native stream.
          borderTopRightRadius: radius.chip,
          backgroundColor: tokens.userSurface,
          borderWidth: 1,
          borderColor: tokens.userBorder,
          ...tokens.boxShadow,
          ...selectableSurface,
        },
        body: { flex: 1, gap: 3 },
        metaRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
        },
        label: {
          fontFamily: tokens.fontUi,
          fontSize: tokens.fs(10),
          fontWeight: "600",
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: tokens.userTextMuted,
        },
        copyButton: {
          paddingHorizontal: 4,
          paddingVertical: 2,
        },
        clock: {
          fontFamily: tokens.fontUi,
          fontSize: tokens.fs(10),
          color: tokens.userTextMuted,
        },
        text: {
          fontFamily: tokens.fontUi,
          fontSize: tokens.fs(13.5),
          lineHeight: tokens.fs(20),
          color: tokens.userText,
        },
        imageRow: {
          marginTop: 8,
          gap: 6,
        },
        image: {
          width: "100%",
          // Tall enough to read, bounded so a screenshot cannot take over
          // the thread.
          height: 200,
          borderRadius: radius.block,
          backgroundColor: tokens.userBorder,
        },
        usageRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          flexWrap: "wrap",
          gap: 10,
          marginTop: 7,
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: tokens.userBorder,
        },
        usageKey: {
          fontFamily: tokens.fontUi,
          fontSize: tokens.fs(10),
          color: tokens.userTextMuted,
        },
        usageValue: {
          fontFamily: tokens.fontUi,
          fontSize: tokens.fs(11),
          fontWeight: "600",
          color: tokens.userText,
        },
      }),
    [tokens],
  );

  return (
    <View {...selectionSurface} style={styles.container}>
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text selectable style={styles.label}>
            You
          </Text>
          {timestamp ? (
            <Text selectable style={styles.clock}>
              {formatMessageTime(timestamp)}
            </Text>
          ) : null}
          <Pressable
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel="Copy prompt"
            style={styles.copyButton}
          >
            <Pop trigger={copied}>
              <Glyph
                name={copied ? "Check" : "Copy"}
                size={11}
                color={copied ? tokens.userText : tokens.userTextMuted}
              />
            </Pop>
          </Pressable>
        </View>
        <Text
          selectable
          style={styles.text}
          numberOfLines={plan && folded ? maxLines : undefined}
        >
          {text}
        </Text>
        {plan ? (
          <FoldBar
            hidden={plan.hidden}
            open={open}
            tokens={tokens}
            closedLabel="Show full prompt"
            onPress={() => setOpen(!open)}
          />
        ) : null}
        {images?.length ? (
          <View style={styles.imageRow}>
            {images.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={styles.image}
                resizeMode="contain"
                accessibilityLabel="Attached image"
              />
            ))}
          </View>
        ) : null}
        {usage ? (
          <View style={styles.usageRow}>
            <UsageFigure label="in" value={usage.inputTokens} styles={styles} />
            <UsageFigure label="cached" value={usage.cachedInputTokens} styles={styles} />
            <UsageFigure label="out" value={usage.outputTokens} styles={styles} />
            {pending ? (
              <Text selectable style={styles.usageKey}>
                counting…
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
