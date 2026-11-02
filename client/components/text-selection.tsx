import React, { useCallback, useState } from "react";
import { Platform, Text } from "react-native";
import { Modal, TextInput } from "@getpaseo/plugin/client/react-native";
import type { ExtendedThemeTokens } from "./theme-tokens";

/**
 * Touch selection for iOS.
 *
 * A plain React Native `<Text selectable>` inside the host timeline never starts
 * a selection on iOS: a long-press on a word does nothing, so a reader cannot
 * copy part of a reply, prompt or code block. Android selects the same text
 * natively, and web has the selection bar, so both are left alone.
 *
 * A read-only multiline `TextInput` is backed by the platform text view, so its
 * selection handles, Select All and Copy all work. Opening the text in one is
 * the touch route to a partial copy. It is reached two ways: a visible Select
 * control beside each Copy button, and a long-press on the text itself.
 */
export const touchSelectionEnabled = Platform.OS === "ios";

export function useTextSelection(text: string) {
  // A snapshot, so a streaming reply cannot change the text behind the dialog.
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const openSelection = useCallback(() => setSnapshot(text), [text]);
  const closeSelection = useCallback(() => setSnapshot(null), []);
  return { snapshot, openSelection, closeSelection };
}

/** Props for a selectable `Text`: a long-press opens the dialog on iOS only. */
export function longPressSelection(openSelection: () => void): { onLongPress?: () => void } {
  return touchSelectionEnabled ? { onLongPress: openSelection } : {};
}

export function TextSelectionDialog({
  text,
  onClose,
  tokens,
}: {
  text: string | null;
  onClose(): void;
  tokens: ExtendedThemeTokens;
}) {
  if (text === null) return null;
  return (
    <Modal
      title="Select text"
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Content>
        <Text
          style={{
            color: tokens.foreground,
            fontSize: tokens.fs(13),
            lineHeight: tokens.fs(20),
          }}
        >
          Touch and hold the text, drag the handles to select the part you need, then tap Copy.
          Select All copies the whole block.
        </Text>
        <TextInput
          accessibilityLabel="Text to copy"
          value={text}
          multiline
          readOnly
          style={{
            color: tokens.foreground,
            backgroundColor: tokens.surface0,
            fontFamily: tokens.fontMono,
            fontSize: tokens.fs(13),
            lineHeight: tokens.fs(20),
            height: 240,
            padding: 12,
            textAlignVertical: "top",
          }}
        />
      </Modal.Content>
    </Modal>
  );
}
