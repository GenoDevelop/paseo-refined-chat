import React, { useRef, useSyncExternalStore } from "react";
import { Platform, StyleSheet, View, type TextStyle, type StyleProp } from "react-native";
import { Markdown } from "@getpaseo/plugin/client/ui";
import type { MdBlock, MdInline } from "./markdown/parse";

export function isSelectableProseBlock(block: MdBlock): boolean {
  switch (block.kind) {
    case "paragraph": case "heading": return selectableProseMarkdown(block.spans) !== null;
    case "quote": return block.paragraphs.every(spans => selectableProseMarkdown(spans) !== null);
    case "list": return block.items.every(item => item.checked === undefined && selectableProseMarkdown(item.spans) !== null);
    default: return false;
  }
}

export function selectableProseMarkdown(spans: MdInline[]): string | null {
  const parts: string[] = [];
  for (const span of spans) {
    if (span.kind === "text") parts.push(span.text.replace(/([\\`*_{}\[\]()#+.!>|~-])/g, "\\$1"));
    else if (span.kind === "codeSpan") {
      // Paths retain the plugin's file-opening handler.
      if (/[/\\]|https?:/.test(span.text)) return null;
      const fence = "`".repeat(Math.max(0, ...(span.text.match(/`+/g) || []).map(run => run.length)) + 1);
      parts.push(`${fence} ${span.text} ${fence}`);
    } else if (span.kind === "strong" || span.kind === "emphasis" || span.kind === "strike") {
      const inner = selectableProseMarkdown(span.spans);
      if (inner === null) return null;
      const marker = span.kind === "strong" ? "**" : span.kind === "emphasis" ? "*" : "~~";
      parts.push(marker + inner + marker);
    } else return null;
  }
  return parts.join("");
}

interface Fiber {
  type?: unknown;
  memoizedProps?: Record<string, unknown>;
  child?: Fiber;
  sibling?: Fiber;
}
interface NativeTemplate { type: React.ComponentType<Record<string, unknown>>; props: Record<string, unknown> }
let template: NativeTemplate | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

type ClipboardEvents = { addListener(event: string, callback: () => void): { remove(): void } };
let clipboardSubscription: { remove(): void } | undefined;
const selectionListeners = new Set<() => void>();
let selectionRevision = 0;
export const clipboardSelectionSnapshot = () => selectionRevision;
export function subscribeClipboardSelectionReset(listener: () => void): () => void {
  selectionListeners.add(listener);
  if (!clipboardSubscription) {
    try {
      // Expo already ships in Paseo. Observe change notifications only: never
      // request clipboard contents or infer an action from its translated label.
      const clipboard = (globalThis as { expo?: { modules?: { ExpoClipboard?: ClipboardEvents } } }).expo?.modules?.ExpoClipboard;
      clipboardSubscription = clipboard?.addListener("onClipboardChanged", () => {
        selectionRevision++;
        selectionListeners.forEach(notify => notify());
      });
    } catch { /* Older hosts keep native selection without automatic reset. */ }
  }
  return () => {
    selectionListeners.delete(listener);
    if (!selectionListeners.size) {
      clipboardSubscription?.remove();
      clipboardSubscription = undefined;
    }
  };
}

/** Read only the probe's subtree, never another timeline item's native props. */
export function findNativeProse(root: Fiber): NativeTemplate | null {
  const pending = root.child ? [root.child] : [];
  let visited = 0;
  while (pending.length && visited++ < 200) {
    const node = pending.pop()!;
    const props = node.memoizedProps;
    // Capture the JS component, not the native leaf: the JS wrapper owns
    // block-slot children, normalisation and measurement for this app version.
    if (typeof node.type === "function" && typeof props?.markdown === "string"
      && props.markdownStyle && typeof props.markdownStyle === "object" && !props.uniProps) {
      const safe = Object.fromEntries(Object.entries(props).filter(([key]) => !/^on[A-Z]/.test(key) && !["children", "ref", "style", "nativeID", "testID"].includes(key)));
      return { type: node.type as NativeTemplate["type"], props: safe };
    }
    if (node.sibling) pending.push(node.sibling);
    if (node.child) pending.push(node.child);
  }
  return null;
}

/** Experimental iOS adapter: reuse the installed native view and its own schema. */
export function IOSSelectableProse({ markdown, textStyle, inlineStyles, blockStyles, paragraphGap = 0, children }: {
  markdown: string; textStyle: StyleProp<TextStyle>; children: React.ReactNode;
  inlineStyles?: { strong: TextStyle; emphasis: TextStyle; code: TextStyle };
  paragraphGap?: number;
  blockStyles?: Record<string, Record<string, unknown>>;
}) {
  const current = useSyncExternalStore(subscribe, () => template, () => null);
  const probe = useRef<View>(null);
  const selectionEpoch = useSyncExternalStore(subscribeClipboardSelectionReset, clipboardSelectionSnapshot, () => 0);
  if (Platform.OS !== "ios") return <>{children}</>;
  if (current) {
    const style = StyleSheet.flatten(textStyle) || {};
    const base = current.props.markdownStyle as Record<string, unknown>;
    const paragraph = { ...(base.paragraph as object), fontFamily: style.fontFamily,
      fontSize: style.fontSize, lineHeight: style.lineHeight, color: style.color, marginTop: 0, marginBottom: paragraphGap };
    const blocks = Object.fromEntries(Object.entries(blockStyles || {}).map(([key, value]) =>
      [key, { ...(base[key] as object), ...value }]));
    return React.createElement(current.type, { ...current.props, markdown, selectable: true,
      // CommonMark keeps the prose in one native text view rather than GFM's
      // separate block slots, allowing a selection across paragraph boundaries.
      flavor: "commonmark", key: selectionEpoch,
      allowFontScaling: false, enableLinkPreview: false, markdownStyle: { ...base, ...blocks, paragraph,
        ...(inlineStyles ? {
          strong: { ...(base.strong as object), ...inlineStyles.strong },
          emphasis: { ...(base.emphasis as object), ...inlineStyles.emphasis },
          code: { ...(base.code as object), ...inlineStyles.code },
        } : {}),
      },
      containerStyle: { alignSelf: "stretch" } });
  }
  return <>
    {children}
    <View ref={probe} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ height: 0, overflow: "hidden", opacity: 0 }} onLayout={() => {
        if (template) return;
        const host = probe.current as unknown as { __internalInstanceHandle?: Fiber } | null;
        const found = host?.__internalInstanceHandle && findNativeProse(host.__internalInstanceHandle);
        if (found) { template = found; setTimeout(() => listeners.forEach(listener => listener()), 0); }
      }}>
      <Markdown>Selection probe</Markdown>
    </View>
  </>;
}
