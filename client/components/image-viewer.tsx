import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  Modal,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import type { ViewStyle } from "react-native";
import { Glyph } from "./glyph";
import { unselectable } from "./selection";

interface ImageViewerProps {
  visible: boolean;
  uri: string;
  /** Names the picture for a screen reader and for the line under it. */
  label: string;
  /** Size and weight, drawn under the label when known. */
  details?: string;
  /** The picture's own pixels, when known. */
  width?: number | null;
  height?: number | null;
  onClose(): void;
}

/** Room left around the picture so it never touches the edge of the window. */
const MARGIN = 24;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;
const STEP = 1.25;
/** A press that moved less than this is a click, not the start of a drag. */
const DRAG_SLOP = 4;

const web = Platform.OS === "web";

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * An image over a dimmed page.
 *
 * It opens at its own size, or smaller when the window cannot hold it, and never
 * larger: a 32 px icon is not blown up to the window. The wheel zooms around the
 * pointer, a drag moves the picture, and the buttons do the same without a
 * mouse. Esc, the close button and a press on the backdrop close it.
 */
export function ImageViewer({
  visible,
  uri,
  label,
  details,
  width,
  height,
  onClose,
}: ImageViewerProps) {
  const window = useWindowDimensions();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; from: { x: number; y: number }; moved: boolean } | null>(
    null,
  );

  // Where a two-finger gesture began: how far apart the fingers were, the zoom
  // and offset then, and the point between them.
  const pinch = useRef<{
    distance: number;
    zoom: number;
    middle: { x: number; y: number };
    offset: { x: number; y: number };
  } | null>(null);

  const known = Boolean(width && height);
  const naturalWidth = width ?? 0;
  const naturalHeight = height ?? 0;
  const roomWidth = Math.max(window.width - MARGIN * 2, 1);
  const roomHeight = Math.max(window.height - MARGIN * 2, 1);
  // Scale at which the picture fits the window; never above its own size.
  const fit = known ? Math.min(1, roomWidth / naturalWidth, roomHeight / naturalHeight) : 1;

  useEffect(() => {
    if (visible) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [visible, uri]);

  const zoomTo = useCallback(
    (next: number, around?: { x: number; y: number }) => {
      const target = clamp(next, MIN_ZOOM, MAX_ZOOM);
      setOffset((current) => {
        if (!around) return target === 1 ? { x: 0, y: 0 } : current;
        const ratio = target / zoom;
        return {
          x: around.x - (around.x - current.x) * ratio,
          y: around.y - (around.y - current.y) * ratio,
        };
      });
      setZoom(target);
    },
    [zoom],
  );

  const shownWidth = known ? naturalWidth * fit * zoom : undefined;
  const shownHeight = known ? naturalHeight * fit * zoom : undefined;
  const percent = Math.round(fit * zoom * 100);

  // The wheel is a web event; a phone zooms with the buttons below.
  const wheelProps = web
    ? ({
        onWheel: (event: { deltaY: number; clientX: number; clientY: number }) => {
          zoomTo(zoom * Math.exp(-event.deltaY * 0.0015), {
            x: event.clientX - window.width / 2,
            y: event.clientY - window.height / 2,
          });
        },
      } as object)
    : {};

  const picture: ViewStyle =
    shownWidth !== undefined && shownHeight !== undefined
      ? {
          width: shownWidth,
          height: shownHeight,
          transform: [{ translateX: offset.x }, { translateY: offset.y }],
        }
      : { width: "100%", height: "100%" };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop} {...wheelProps}>
        <Pressable
          accessibilityLabel="Close the full size image"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[
            picture,
            web ? ({ cursor: zoom > 1 ? "grab" : "default" } as unknown as ViewStyle) : null,
          ]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          // A second finger must not hand the gesture to whatever sits behind.
          onResponderTerminationRequest={() => false}
          onResponderGrant={(event) => {
            drag.current = {
              x: event.nativeEvent.pageX,
              y: event.nativeEvent.pageY,
              from: offset,
              moved: false,
            };
          }}
          onResponderMove={(event) => {
            const touches = event.nativeEvent.touches;
            if (touches.length >= 2) {
              // Two fingers: the picture follows them. The point under the
              // fingers' midpoint when they landed stays under it as they spread
              // or close, so a pinch zooms where the reader is looking, and
              // moving both fingers together moves the picture.
              const [a, b] = [touches[0]!, touches[1]!];
              const distance = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
              const middle = {
                x: (a.pageX + b.pageX) / 2 - window.width / 2,
                y: (a.pageY + b.pageY) / 2 - window.height / 2,
              };
              const start = pinch.current ?? { distance, zoom, middle, offset };
              pinch.current = start;
              drag.current = null;
              if (start.distance < 1) return;
              const target = clamp(start.zoom * (distance / start.distance), MIN_ZOOM, MAX_ZOOM);
              const ratio = target / start.zoom;
              setZoom(target);
              setOffset({
                x: middle.x - (start.middle.x - start.offset.x) * ratio,
                y: middle.y - (start.middle.y - start.offset.y) * ratio,
              });
              return;
            }

            // Back to one finger after a pinch: begin a fresh drag from here, so
            // the picture does not jump to where the first finger first landed.
            pinch.current = null;
            const point = touches[0] ?? event.nativeEvent;
            const start =
              drag.current ??
              (drag.current = { x: point.pageX, y: point.pageY, from: offset, moved: false });
            const dx = point.pageX - start.x;
            const dy = point.pageY - start.y;
            if (Math.abs(dx) + Math.abs(dy) > DRAG_SLOP) start.moved = true;
            if (start.moved) setOffset({ x: start.from.x + dx, y: start.from.y + dy });
          }}
          onResponderRelease={() => {
            drag.current = null;
            pinch.current = null;
          }}
        >
          <Image
            source={{ uri }}
            style={styles.fill}
            resizeMode="contain"
            accessibilityLabel={label}
          />
        </View>

        <View style={styles.bar} pointerEvents="box-none">
          <View style={styles.controls}>
            <Control label="Zoom out" onPress={() => zoomTo(zoom / STEP)}>
              <Text style={styles.glyphText}>−</Text>
            </Control>
            <Text style={[styles.percent, unselectable]}>{known ? `${percent}%` : "fit"}</Text>
            <Control label="Zoom in" onPress={() => zoomTo(zoom * STEP)}>
              <Text style={styles.glyphText}>+</Text>
            </Control>
            {known ? (
              <>
                <Control label="Actual size" onPress={() => zoomTo(1 / fit)}>
                  <Text style={styles.wordText}>1:1</Text>
                </Control>
                <Control label="Fit to window" onPress={() => zoomTo(1)}>
                  <Text style={styles.wordText}>Fit</Text>
                </Control>
              </>
            ) : null}
          </View>
          <Text style={[styles.captionText, unselectable]} numberOfLines={1}>
            {details ? `${label} · ${details}` : label}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.close}
        >
          <Glyph name="X" size={16} color="#ffffff" />
        </Pressable>
      </View>
    </Modal>
  );
}

function Control({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress(): void;
  children: React.ReactNode;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.control}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.88)",
    overflow: "hidden",
  },
  fill: { width: "100%", height: "100%" },
  close: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  bar: {
    position: "absolute",
    bottom: 14,
    left: 24,
    right: 24,
    alignItems: "center",
    gap: 6,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  control: {
    minWidth: 30,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  glyphText: { color: "#ffffff", fontSize: 16, lineHeight: 18 },
  wordText: { color: "#ffffff", fontSize: 11, fontWeight: "600" },
  percent: {
    minWidth: 46,
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 11,
  },
  captionText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    overflow: "hidden",
    maxWidth: "100%",
  },
});
