import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { copyText } from "@getpaseo/plugin/client/react-native";
import { Glyph } from "./glyph";
import { unselectable } from "./selection";
import { formatMessageTime } from "./message-time";
import { radius } from "./theme-tokens";
import type { ExtendedThemeTokens } from "./theme-tokens";
import { TextSelectionDialog, touchSelectionEnabled, useTextSelection } from "./text-selection";

/**
 * The host's own reply footer — copy, fork and the turn's time — is drawn by
 * the stream layout, not by the message renderer: it walks up from the newest
 * item looking for a `assistant_message` stream item
 * (`agent-stream/layout.ts:102`). A transformed item is projected as
 * `kind: "plugin"` (`plugins/timeline/projection.ts:96`), so once this plugin
 * renders the reply the host finds no assistant and draws no footer.
 *
 * This is the part a plugin can rebuild. Fork is not: it needs the daemon
 * client and a timeline cursor (`hooks/use-fork-agent.ts`), and the plugin SDK
 * exposes neither. Turning "Assistant markdown" off in settings hands the reply
 * back to the host, which brings the full footer with it.
 */
interface AssistantFooterProps {
  /** The reply, copied verbatim — the same text the host would copy. */
  text: string;
  at: Date;
  tokens: ExtendedThemeTokens;
}

const COPIED_MS = 1600;

export function AssistantFooter({ text, at, tokens }: AssistantFooterProps) {
  const [copied, setCopied] = useState(false);
  const { snapshot, openSelection, closeSelection } = useTextSelection(text);

  const handleCopy = useCallback(() => {
    void copyText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_MS);
      })
      .catch(() => {
        // Clipboard access can be denied; the label simply does not change.
      });
  }, [text]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginTop: 6,
        },
        copyButton: {
          // Pull the button's own padding back so its icon starts on the text
          // column, the way the host footer does.
          marginLeft: -6,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 6,
          paddingVertical: 3,
          borderRadius: radius.block,
          backgroundColor: copied ? tokens.successBg : "transparent",
        },
        copyLabel: {
          fontFamily: tokens.fontUi,
          fontSize: tokens.fs(11),
          fontWeight: "500",
          color: copied ? tokens.success : tokens.foregroundMuted,
          ...unselectable,
        },
        selectButton: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 6,
          paddingVertical: 3,
          borderRadius: radius.block,
        },
        time: {
          fontFamily: tokens.fontUi,
          fontSize: tokens.fs(11),
          color: tokens.foregroundSubtle,
          ...unselectable,
        },
      }),
    [tokens, copied],
  );

  // The label is recomputed on each render rather than ticked: the footer
  // re-renders whenever the turn does, and a stale minute is not worth a timer.
  const time = formatMessageTime(at);

  return (
    <View style={styles.container}>
      <TextSelectionDialog text={snapshot} onClose={closeSelection} tokens={tokens} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? "Reply copied" : "Copy reply"}
        onPress={handleCopy}
        style={styles.copyButton}
      >
        <Glyph
          name={copied ? "Check" : "Copy"}
          size={12}
          color={copied ? tokens.success : tokens.foregroundMuted}
        />
        <Text style={styles.copyLabel}>{copied ? "Copied" : "Copy"}</Text>
      </Pressable>
      {touchSelectionEnabled ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select part of the reply"
          accessibilityHint="Opens a text field where the platform's selection handles work"
          onPress={openSelection}
          style={styles.selectButton}
        >
          <Glyph name="TextSelect" size={12} color={tokens.foregroundMuted} />
          <Text style={styles.copyLabel}>Select</Text>
        </Pressable>
      ) : null}
      <Text style={styles.time}>{time}</Text>
    </View>
  );
}
