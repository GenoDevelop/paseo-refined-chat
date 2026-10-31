import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Image, Pressable, Text, View } from "react-native";
import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { ScrollView } from "@getpaseo/plugin/client/react-native";
import { hostFontEscape } from "./components/host-font-escape";
import { ImageViewer } from "./components/image-viewer";
import { isImagePath, useImageFile, type ImageFile } from "./image-file";
import { ImageBaseContext, MarkdownView } from "./components/markdown/markdown-view";
import { SyntaxHighlightBlock } from "./components/syntax-highlight";
import { buildThemeTokens, radius, type ExtendedThemeTokens } from "./components/theme-tokens";
import {
  lineSelector,
  readFileRpc,
  revealPathRpc,
  stripSelector,
  MAX_PREVIEW_BYTES,
} from "../shared/file-rpc";
import { MAX_IMAGE_BYTES } from "../shared/image-rpc";
import { useEnhancerPreferences } from "./preferences";

export const FILE_PREVIEW_PANEL_ID = "file-preview";

const MARKDOWN_PADDING = 16;

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
  outside:
    "This file is outside the project folder, so the panel does not read it. Advanced settings can allow that.",
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

  // A picture goes through the image RPC, which reads the bytes and sizes; the
  // text read would refuse it as binary.
  const isImage = current !== null && isImagePath(current.path);
  const image = useImageFile(isImage ? current.path : undefined, current?.cwd ?? null);
  const [enlarged, setEnlarged] = useState(false);

  // A selector such as `app.ts:55` marks that line and scrolls it into view.
  const scroller = useRef<React.ElementRef<typeof ScrollView>>(null);
  const line = current ? lineSelector(current.path) : null;
  const viewport = useRef(0);
  // Layout reports again when a picture loads or the panel resizes; the reader
  // may have scrolled by then, so each file and view is scrolled once.
  const scrolled = useRef(false);
  const scrollToLine = useCallback((y: number) => {
    if (scrolled.current) return;
    scrolled.current = true;
    // The row sits a third of the way down, so the lines before it give context.
    scroller.current?.scrollTo({ y: Math.max(0, y - viewport.current / 3), animated: false });
  }, []);

  // A file opens in its default view: Markdown rendered.
  useEffect(() => {
    setView("rendered");
  }, [current]);
  useEffect(() => {
    scrolled.current = false;
  }, [current, view]);

  useEffect(() => {
    if (!current || isImagePath(current.path)) return;
    let stale = false;
    setLoad({ state: "loading" });
    readFile({
      cwd: current.cwd,
      path: current.path,
      anywhere: preferences.previewOutsideProject,
    }).then(
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
  }, [current, readFile, preferences.previewOutsideProject]);

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
        {isImage && image?.dataUri ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Full screen"
            onPress={() => setEnlarged(true)}
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
              Full screen
            </Text>
          </Pressable>
        ) : null}
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
      {isImage ? (
        <PictureBody
          file={image}
          caption={name}
          tokens={tokens}
          enlarged={enlarged}
          onClose={() => setEnlarged(false)}
          onOpen={() => setEnlarged(true)}
        />
      ) : load.state === "ready" ? (
        <ScrollView
          ref={scroller}
          style={{ flex: 1 }}
          onLayout={(event) => {
            viewport.current = event.nativeEvent.layout.height;
          }}
        >
          {isMarkdown && view === "rendered" ? (
            <View style={{ padding: MARKDOWN_PADDING }}>
              <ImageBaseContext.Provider value={fileDirectory(current.cwd, name)}>
                <MarkdownView
                  text={load.text}
                  tokens={tokens}
                  variant={preferences.markdownVariant}
                  marks={preferences.highlightMarks}
                  line={line ?? undefined}
                  // The text sits below the panel's padding.
                  onLinePosition={(y) => scrollToLine(y + MARKDOWN_PADDING)}
                />
              </ImageBaseContext.Provider>
            </View>
          ) : (
            // Keyed by the whole path so a new line selector starts from a fresh layout.
            <SyntaxHighlightBlock
              key={current.path}
              code={load.text}
              filename={name}
              tokens={tokens}
              showLineNumbers
              compact
              highlightLine={line ?? undefined}
              onHighlightPosition={scrollToLine}
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

/** The whole picture, fitted to the panel's width; pressing it opens it full screen. */
function PictureBody({
  file,
  caption,
  tokens,
  enlarged,
  onOpen,
  onClose,
}: {
  file: ImageFile | null;
  caption: string;
  tokens: ExtendedThemeTokens;
  enlarged: boolean;
  onOpen(): void;
  onClose(): void;
}) {
  if (file === null) return <Message tokens={tokens} text="Loading…" />;
  if (file.dataUri === null) {
    // The daemon reports the size of a picture it declined to read.
    if (file.bytes && file.bytes > MAX_IMAGE_BYTES) {
      return (
        <Message
          tokens={tokens}
          text={`This picture is ${formatBytes(file.bytes)}, over the ${MAX_IMAGE_BYTES / 1024 / 1024} MB the panel draws. Open it in the file manager.`}
        />
      );
    }
    return <Message tokens={tokens} text={file.error ?? "The image could not be read."} />;
  }
  const ratio = file.width && file.height ? file.width / file.height : 1;
  const details = [
    file.width && file.height ? `${file.width} × ${file.height}` : null,
    file.bytes ? formatBytes(file.bytes) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${caption}. Full screen`} onPress={onOpen}>
        <Image
          source={{ uri: file.dataUri }}
          style={{ width: "100%", aspectRatio: ratio, borderRadius: radius.block }}
          resizeMode="contain"
        />
      </Pressable>
      {details ? (
        <Text style={{ color: tokens.foregroundMuted, fontFamily: tokens.fontUi, fontSize: tokens.fs(11) }}>
          {details}
        </Text>
      ) : null}
      <ImageViewer
        visible={enlarged}
        uri={file.dataUri}
        label={caption}
        details={details || undefined}
        width={file.width}
        height={file.height}
        onClose={onClose}
      />
    </ScrollView>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
