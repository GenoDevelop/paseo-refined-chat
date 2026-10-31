import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";
import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { ScrollView } from "@getpaseo/plugin/client/react-native";
import { hostFontEscape } from "./components/host-font-escape";
import { ImageBaseContext, MarkdownView } from "./components/markdown/markdown-view";
import { SyntaxHighlightBlock } from "./components/syntax-highlight";
import { buildThemeTokens, radius, type ExtendedThemeTokens } from "./components/theme-tokens";
import { readFileRpc, revealPathRpc, stripSelector, MAX_PREVIEW_BYTES } from "../shared/file-rpc";
import { useEnhancerPreferences } from "./preferences";

export const FILE_PREVIEW_PANEL_ID = "file-preview";

interface PreviewTarget {
  cwd: string;
  path: string;
}

type OpenPanel = (
  id: string,
  options: { workspaceId: string; location?: "explorer" | "workspace" },
) => void;

/**
 * The panel gets no parameters from `openPanel`, so the file to show is handed
 * over through this store before the panel is opened. A second press replaces
 * the file in the panel that is already open.
 */
let target: PreviewTarget | null = null;
let openPanel: OpenPanel | null = null;
const listeners = new Set<() => void>();

export function registerPanelOpener(opener: OpenPanel | null): void {
  openPanel = opener;
}

/** Shows a file in the side panel. False when the host cannot open panels. */
export function openFilePreview(workspaceId: string, cwd: string, path: string): boolean {
  if (!openPanel) return false;
  target = { cwd, path };
  for (const listener of listeners) listener();
  openPanel(FILE_PREVIEW_PANEL_ID, { workspaceId, location: "explorer" });
  return true;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The folder holding the file, as an absolute path: the base for the images it names. */
function fileDirectory(cwd: string, path: string): string {
  const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const folder = cut === -1 ? "" : path.slice(0, cut);
  if (/^([a-zA-Z]:[\\/]|[\\/])/.test(path)) return folder;
  return folder === "" ? cwd : `${cwd}/${folder}`;
}

type Load =
  | { state: "loading" }
  | { state: "ready"; text: string }
  | { state: "refused"; message: string };

const REFUSALS = {
  outside: "This file is outside the project folder, so the panel does not read it.",
  binary: "This is not a text file.",
  large: `This file is larger than ${MAX_PREVIEW_BYTES / 1024 / 1024} MB.`,
  missing: "This file was not found.",
} as const;

export function FilePreviewPanel({ theme }: PluginWorkspacePanelProps) {
  const preferences = useEnhancerPreferences();
  const tokens = useMemo(
    () => buildThemeTokens(theme.colors, preferences),
    [theme.colors, preferences],
  );
  const current = useSyncExternalStore(
    subscribe,
    () => target,
    () => target,
  );
  const readFile = useRpc(readFileRpc);
  const revealPath = useRpc(revealPathRpc);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  // A Markdown file opens rendered; the reader can flip to its source.
  const [view, setView] = useState<"rendered" | "source">("rendered");

  useEffect(() => {
    if (!current) return;
    let stale = false;
    setLoad({ state: "loading" });
    readFile({ cwd: current.cwd, path: current.path }).then(
      (result) => {
        if (stale) return;
        setLoad(
          result.text !== null
            ? { state: "ready", text: result.text }
            : { state: "refused", message: REFUSALS[result.reason ?? "missing"] },
        );
      },
      () => {
        if (!stale) setLoad({ state: "refused", message: REFUSALS.missing });
      },
    );
    return () => {
      stale = true;
    };
  }, [current, readFile]);

  const handleReveal = useCallback(() => {
    if (current) void revealPath({ cwd: current.cwd, path: current.path }).catch(() => {});
  }, [current, revealPath]);

  if (!current) {
    return (
      <Message tokens={tokens} text="Press a file path in a reply to see the file here." />
    );
  }

  const name = stripSelector(current.path);
  const isMarkdown = /\.(md|markdown|mdx)$/i.test(name);
  return (
    <View {...hostFontEscape} style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: tokens.borderSubtle,
        }}
      >
        <Text
          numberOfLines={1}
          selectable
          style={{
            flex: 1,
            color: tokens.foreground,
            fontFamily: tokens.fontMono,
            fontSize: tokens.fs(12),
          }}
        >
          {name}
        </Text>
        {isMarkdown ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={view === "rendered" ? "Show the source" : "Show rendered"}
            onPress={() => setView(view === "rendered" ? "source" : "rendered")}
            style={{
              borderWidth: 1,
              borderColor: tokens.border,
              borderRadius: radius.block,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{ color: tokens.foregroundMuted, fontFamily: tokens.fontUi, fontSize: tokens.fs(11) }}
            >
              {view === "rendered" ? "Source" : "Rendered"}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show in file manager"
          onPress={handleReveal}
          style={{
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: radius.block,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text
            style={{ color: tokens.foregroundMuted, fontFamily: tokens.fontUi, fontSize: tokens.fs(11) }}
          >
            Show in file manager
          </Text>
        </Pressable>
      </View>
      {load.state === "ready" ? (
        <ScrollView style={{ flex: 1 }}>
          {isMarkdown && view === "rendered" ? (
            <View style={{ padding: 16 }}>
              <ImageBaseContext.Provider value={fileDirectory(current.cwd, name)}>
                <MarkdownView
                  text={load.text}
                  tokens={tokens}
                  variant={preferences.markdownVariant}
                  marks={preferences.highlightMarks}
                />
              </ImageBaseContext.Provider>
            </View>
          ) : (
            <SyntaxHighlightBlock
              code={load.text}
              filename={name}
              tokens={tokens}
              showLineNumbers
              compact
            />
          )}
        </ScrollView>
      ) : (
        <Message
          tokens={tokens}
          text={load.state === "loading" ? "Loading…" : load.message}
        />
      )}
    </View>
  );
}

function Message({ tokens, text }: { tokens: ExtendedThemeTokens; text: string }) {
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: tokens.foregroundMuted, fontFamily: tokens.fontUi, fontSize: tokens.fs(13) }}>
        {text}
      </Text>
    </View>
  );
}
