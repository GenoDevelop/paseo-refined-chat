import type { PluginClientContext } from "@getpaseo/plugin/client";
import { z } from "zod";
import { BeautifulChatSettingsPage } from "./client/settings-page";
import { embedFonts } from "./client/components/embed-fonts";
import { FILE_PREVIEW_PANEL_ID, FilePreviewPanel, registerPanelOpener } from "./client/file-preview";
import { installFrostedGlass } from "./client/components/frosted";
import { installShimmer } from "./client/components/shimmer";
import { installPointerGlow } from "./client/components/glow";
import { installHostNoticeStyle } from "./client/components/host-notice";
import { installChatFind } from "./client/components/chat-find";
import { installLinkStyle } from "./client/components/markdown/link-style";
import { extractPromptImages } from "./client/prompt-images";
import { getEnhancerPreferences } from "./client/preferences";
import { yieldsToHost } from "./client/host-chat-display";
import {
  isCardHidden,
  noteCardStatus,
  onHiddenChange,
  reasoningCardId,
  toolCardId,
} from "./client/card-runs";
import {
  LiveToolCallRenderer,
  LiveReasoningRenderer,
  LiveTodoRenderer,
  LiveUserMessageRenderer,
  LiveNoticeRenderer,
  LiveAssistantRenderer,
  extractErrorText,
} from "./client/live-renderers";

type JsonValue = boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };

/** True for a card a bar hid, while the bar setting is on. */
function hiddenByBar(id: string): boolean {
  return getEnhancerPreferences().cardRunBar && isCardHidden(id);
}

function toJsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}

export default function contribute(client: PluginClientContext) {
  // Install the bundled faces before any surface paints.
  const removeFonts = embedFonts();
  const removeFrost = installFrostedGlass();
  const removeShimmer = installShimmer();
  const removeGlow = installPointerGlow();
  // The host draws  rows itself; this only re-chromes them.
  const removeNoticeStyle = installHostNoticeStyle();
  // Paseo's Ctrl+F cannot reveal rows this plugin draws; this bar can.
  const removeChatFind = installChatFind();
  // Reply links show where they go before they are clicked.
  const removeLinkStyle = installLinkStyle();

  // Configuration lives in the host Settings area. The plugin has no showcase
  // surface, panels, or Command Center item.
  client.addSettingsScreen({
    id: "chat-presentation",
    title: "Refined Chat presentation",
    icon: "Blocks",
    Component: BeautifulChatSettingsPage,
  });

  const removeFilePanel = client.addWorkspacePanel({
    id: FILE_PREVIEW_PANEL_ID,
    title: "File preview",
    icon: "FileText",
    locations: ["explorer"],
    Component: FilePreviewPanel,
  });
  registerPanelOpener((id, options) => client.openPanel(id, options));

  // Live chat timeline interception: render real tool calls, reasoning, and todos with enhanced UI.
  // A bar over a run of cards hides the cards through these transformers. The
  // host keeps what they returned per item, so a change registers them again.
  const addToolTransformer = () => client.addTimelineTransformer({
    id: "omp-enhanced-tool-call",
    query: { itemType: "tool_call" },
    transform({ item, phase }) {
      if (item.type !== "tool_call") return undefined;
      if (yieldsToHost("tool_call")) return undefined;
      const toolId = toolCardId(item.callId);
      if (toolId && hiddenByBar(toolId)) {
        noteCardStatus(
          toolId,
          item.status === "running" ? "running" : item.status === "failed" ? "failed" : "done",
        );
        return { items: [] };
      }
      return {
        items: [
          {
            type: "plugin" as const,
            kind: "omp-tool-call",
            version: 1,
            data: {
              name: item.name,
              status: item.status,
              detail: toJsonValue(item.detail),
              ...(item.callId ? { callId: item.callId } : {}),
              error: extractErrorText(item.error),
              phase,
            },
          },
        ],
      };
    },
  });
  let removeToolTransformer = addToolTransformer();

  const removeToolRenderer = client.addTimelineRenderer({
    kind: "omp-tool-call",
    version: 1,
    schema: z.object({
      name: z.string(),
      status: z.string(),
      detail: z.record(z.string(), z.unknown()).optional(),
      callId: z.string().optional(),
      error: z.string().nullable().optional(),
      phase: z.string().optional(),
    }),
    Component: LiveToolCallRenderer,
  });

  const addReasoningTransformer = () => client.addTimelineTransformer({
    id: "omp-enhanced-reasoning",
    query: { itemType: "reasoning" },
    transform({ item, phase }) {
      if (item.type !== "reasoning") return undefined;
      if (yieldsToHost("reasoning")) return undefined;
      const reasoningId = reasoningCardId(item.text);
      if (hiddenByBar(reasoningId)) {
        noteCardStatus(reasoningId, phase === "streaming" ? "running" : "done");
        return { items: [] };
      }
      return {
        items: [
          {
            type: "plugin" as const,
            kind: "omp-reasoning",
            version: 1,
            data: {
              text: item.text,
              phase,
            },
          },
        ],
      };
    },
  });
  let removeReasoningTransformer = addReasoningTransformer();
  const removeHiddenListener = onHiddenChange(() => {
    removeToolTransformer();
    removeToolTransformer = addToolTransformer();
    removeReasoningTransformer();
    removeReasoningTransformer = addReasoningTransformer();
  });

  const removeReasoningRenderer = client.addTimelineRenderer({
    kind: "omp-reasoning",
    version: 1,
    schema: z.object({
      text: z.string(),
      phase: z.string().optional(),
    }),
    Component: LiveReasoningRenderer,
  });

  const removeTodoTransformer = client.addTimelineTransformer({
    id: "omp-enhanced-todo",
    query: { itemType: "todo" },
    transform({ item, phase }) {
      if (item.type !== "todo") return undefined;
      return {
        items: [
          {
            type: "plugin" as const,
            kind: "omp-todo",
            version: 1,
            data: {
              items: toJsonValue(item.items),
              phase,
            },
          },
        ],
      };
    },
  });

  const removeTodoRenderer = client.addTimelineRenderer({
    kind: "omp-todo",
    version: 1,
    schema: z.object({
      items: z.array(z.record(z.string(), z.unknown())),
      phase: z.string().optional(),
    }),
    Component: LiveTodoRenderer,
  });

  const removeUserTransformer = client.addTimelineTransformer({
    id: "omp-enhanced-user-message",
    query: { itemType: "user_message" },
    transform({ item }) {
      if (item.type !== "user_message") return undefined;
      // The host strips images while mapping the stream item, so an enhanced
      // bubble would silently swallow a pasted screenshot. The preference lets
      // the reader trade the bubble for the host's image previews.
      if (!getEnhancerPreferences().enhancedUserBubble) return undefined;
      if (yieldsToHost("user_message")) return undefined;
      const images = extractPromptImages(item);
      // Replacing the item drops whatever this renderer does not carry, so a
      // message with an attachment it cannot show is left to the host.
      if (images.hasUnrenderable) return undefined;
      // A prompt with no text is a pasted image and nothing else. The host
      // withholds the image from the plugin, so there is nothing here to draw:
      // an empty bubble would replace the screenshot with a blank. The host's
      // own bubble still has the image. A prompt with text and an image cannot
      // be told from a plain one, so it still loses the image; see the
      // `enhancedUserBubble` preference.
      if (item.text.trim() === "" && images.uris.length === 0) return undefined;
      // `messageId` rides along so the renderer can carry the host's own
      // `data-history-row-id`, which is the id the chat outline scrolls to.
      // Replacing the item leaves the outline nothing to find otherwise.
      return {
        items: [
          {
            type: "plugin" as const,
            kind: "omp-user-message",
            version: 1,
            data: toJsonValue({
              text: item.text,
              ...(images.uris.length > 0 ? { images: images.uris } : {}),
              ...(item.messageId ? { messageId: item.messageId } : {}),
            }),
          },
        ],
      };
    },
  });

  const removeUserRenderer = client.addTimelineRenderer({
    kind: "omp-user-message",
    version: 1,
    schema: z.object({
      text: z.string(),
      images: z.array(z.string()).optional(),
      messageId: z.string().optional(),
    }),
    Component: LiveUserMessageRenderer,
  });

  // The assistant's reply. The preference is read inside `transform` so a
  // change takes effect on the next message without a plugin reload, and a
  // reply the plugin should not own is left to the host.
  const removeAssistantTransformer = client.addTimelineTransformer({
    id: "omp-enhanced-assistant",
    query: { itemType: "assistant_message" },
    transform({ item }) {
      if (item.type !== "assistant_message") return undefined;
      if (!getEnhancerPreferences().assistantMarkdown) return undefined;
      if (yieldsToHost("assistant_message")) return undefined;
      if (!item.text.trim()) return undefined;
      return {
        items: [
          {
            type: "plugin" as const,
            kind: "omp-assistant",
            version: 1,
            data: { text: item.text },
          },
        ],
      };
    },
  });

  const removeAssistantRenderer = client.addTimelineRenderer({
    kind: "omp-assistant",
    version: 1,
    schema: z.object({ text: z.string() }),
    Component: LiveAssistantRenderer,
  });

  // Only `error` is intercepted here. Paseo 0.8 accepts transformers for
  // user_message, assistant_message, reasoning, tool_call, todo, error, and
  // compaction; `notification` — the ⓘ row a finished background job produces —
  // is not on that list, and registering it throws. Every contribution in this
  // function shares one call frame, so that throw drops every renderer the
  // plugin installs and the whole chat falls back to native styling. Add the
  // notification transformer the day the host accepts the type, not before.

  const removeErrorTransformer = client.addTimelineTransformer({
    id: "omp-enhanced-error",
    query: { itemType: "error" },
    transform({ item }) {
      if (item.type !== "error") return undefined;
      return {
        items: [
          {
            type: "plugin" as const,
            kind: "omp-notice",
            version: 1,
            data: { level: "error", message: item.message, fatal: true },
          },
        ],
      };
    },
  });

  const removeNoticeRenderer = client.addTimelineRenderer({
    kind: "omp-notice",
    version: 1,
    schema: z.object({
      level: z.string(),
      message: z.string(),
      fatal: z.boolean().optional(),
    }),
    Component: LiveNoticeRenderer,
  });

  return () => {
    registerPanelOpener(null);
    removeFilePanel();
    removeFonts();
    removeFrost();
    removeShimmer();
    removeGlow();
    removeNoticeStyle();
    removeChatFind();
    removeLinkStyle();
    removeHiddenListener();
    removeToolTransformer();
    removeToolRenderer();
    removeReasoningTransformer();
    removeReasoningRenderer();
    removeTodoTransformer();
    removeTodoRenderer();
    removeUserTransformer();
    removeUserRenderer();
    removeAssistantTransformer();
    removeAssistantRenderer();
    removeErrorTransformer();
    removeNoticeRenderer();
  };
}
