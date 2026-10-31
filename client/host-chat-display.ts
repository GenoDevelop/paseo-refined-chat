import { getEnhancerPreferences } from "./preferences";

export type HostChatDisplay = "full" | "collapseToolCalls" | "collapseTurns";

/** The rows a plugin can leave to the host so the host's folding can see them. */
export type HostFoldRow = "tool_call" | "reasoning" | "user_message" | "assistant_message";

/**
 * Paseo's own settings record. The plugin SDK carries none of it, so this
 * reads the record the host keeps in `localStorage` on web and desktop. Native
 * clients have no `localStorage`; the answer is then "full", which keeps this
 * plugin's own cards.
 */
export function readHostChatDisplay(): HostChatDisplay {
  try {
    const store = (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;
    const raw = store?.getItem("@paseo:app-settings");
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    if (!parsed || typeof parsed !== "object") return "full";
    const record = parsed as Record<string, unknown>;
    const display = record.chatDisplay;
    if (display === "collapseToolCalls" || display === "collapseTurns" || display === "full") {
      return display;
    }
    // COMPAT: before Paseo 0.13 the same choice was `toolCallDetailLevel`, and
    // the host reads `overview` (and the older `concise`) as folded tool calls.
    const level = record.toolCallDetailLevel;
    if (level === "overview" || level === "concise") return "collapseToolCalls";
    if (level === undefined && record.compactToolCalls === true) return "collapseToolCalls";
    return "full";
  } catch {
    return "full";
  }
}

/**
 * True when this plugin should leave a row to the host. Folding tool calls
 * needs the host's own `tool_call` and reasoning rows; folding turns also
 * needs its user prompt and last reply, which anchor the folded turn.
 */
export function yieldsToHost(row: HostFoldRow): boolean {
  if (!getEnhancerPreferences().yieldToHostFolding) return false;
  const display = readHostChatDisplay();
  if (display === "collapseTurns") return true;
  return display === "collapseToolCalls" && (row === "tool_call" || row === "reasoning");
}
