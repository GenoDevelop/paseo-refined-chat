import React, { useMemo, useState } from "react";
import { View, Text, Pressable, Image, Platform, StyleSheet } from "react-native";
import type { ViewStyle } from "react-native";
import { ImageViewer } from "./image-viewer";
import { radius } from "./theme-tokens";
import type { ExtendedThemeTokens } from "./theme-tokens";
import { unselectable } from "./selection";
import type { ImageFile } from "../image-file";

interface ReplyImageProps {
  /** Null while the daemon is still reading the file. */
  file: ImageFile | null;
  /** The agent's description, or the file or server name when it gave none. */
  caption: string;
  tokens: ExtendedThemeTokens;
}

/** The tallest a picture in a reply grows; a card of its own is for reads. */
export const THUMB_HEIGHT = 150;
/** The width of a picture whose size is not known yet, and of the tile that holds one. */
export const THUMB_WIDTH = 200;
const UNKNOWN_WIDTH = THUMB_WIDTH;

const ZOOM_CURSOR = (Platform.OS === "web" ? { cursor: "zoom-in" } : {}) as ViewStyle;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A picture the agent put in its reply, drawn as the picture: no frame, no
 * header. The caption and the size sit over its lower edge while the pointer is
 * on it, and a press opens it full size, where the same line is shown again for
 * a touch screen that has no pointer to hover with.
 */
export function ReplyImage({ file, caption, tokens }: ReplyImageProps) {
  const [hovered, setHovered] = useState(false);
  const [enlarged, setEnlarged] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        thumb: {
          borderRadius: radius.block,
          overflow: "hidden",
          maxWidth: "100%",
          backgroundColor: tokens.surface0,
        },
        image: { width: "100%", height: "100%" },
        overlay: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 8,
          paddingVertical: 5,
          backgroundColor: "rgba(0, 0, 0, 0.68)",
        },
        overlayTitle: {
          fontFamily: tokens.fontUi,
          fontSize: tokens.fs(11),
          color: "#ffffff",
          ...unselectable,
        },
        overlayInfo: {
          fontFamily: tokens.fontUi,
          fontSize: tokens.fs(10),
          color: "rgba(255, 255, 255, 0.72)",
          ...unselectable,
        },
        note: {
          fontFamily: tokens.fontUi,
          fontSize: tokens.fs(11.5),
          color: tokens.foregroundMuted,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: radius.block,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
        },
      }),
    [tokens],
  );

  if (file === null) return <Text style={styles.note}>Reading {caption}…</Text>;
  if (file.dataUri === null) {
    return <Text style={styles.note}>{file.error ?? "The image could not be read."}</Text>;
  }

  const uri = file.dataUri;
  const ratio = file.width && file.height ? file.width / file.height : null;
  const height = file.height ? Math.min(THUMB_HEIGHT, file.height) : THUMB_HEIGHT;
  const size: ViewStyle = ratio
    ? { height, aspectRatio: ratio }
    : { height, width: UNKNOWN_WIDTH };

  const info: string[] = [];
  if (file.width && file.height) info.push(`${file.width} × ${file.height}`);
  if (file.bytes) info.push(formatBytes(file.bytes));
  const details = info.join(" · ");

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${caption}${details ? `, ${details}` : ""}. Open full size`}
        onPress={() => setEnlarged(true)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={[styles.thumb, size, ZOOM_CURSOR]}
      >
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        {hovered ? (
          <View style={styles.overlay} pointerEvents="none">
            <Text style={styles.overlayTitle} numberOfLines={1}>
              {caption}
            </Text>
            {details ? <Text style={styles.overlayInfo}>{details}</Text> : null}
          </View>
        ) : null}
      </Pressable>
      <ImageViewer
        visible={enlarged}
        uri={uri}
        label={caption}
        details={details || undefined}
        width={file.width}
        height={file.height}
        onClose={() => setEnlarged(false)}
      />
    </>
  );
}
