import { useSyncExternalStore } from "react";

export const ACCENT_PRESETS = {
  host: undefined,
  jade: "#10b981",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  rose: "#f43f5e",
} as const;

export type AccentPreset = keyof typeof ACCENT_PRESETS;
export type UiFontPreference = "inter" | "system";
export type CodeFontPreference = "code" | "plain";
export type MarkdownVariantPreference = "document" | "compact" | "terminal";

/** Arbitrary percentage input, with safety bounds to avoid unreadable layouts. */
export const TYPOGRAPHY_SCALE_MIN = 0.5; // 50%
export const TYPOGRAPHY_SCALE_MAX = 3; // 300%

export function sanitizeTypographyScale(value: unknown, fallback = 1): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(TYPOGRAPHY_SCALE_MIN, Math.min(TYPOGRAPHY_SCALE_MAX, value));
}

/** Line spacing of replies; below 80% lines touch, above 200% a paragraph falls apart. */
export const LINE_SPACING_MIN = 0.8;
export const LINE_SPACING_MAX = 2;

export function sanitizeLineSpacing(value: unknown, fallback = 1): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(LINE_SPACING_MIN, Math.min(LINE_SPACING_MAX, value));
}

/** Zero turns folding off; the top bound only keeps a typo from being absurd. */
export const LINE_LIMIT_MAX = 10_000;

export function sanitizeLineLimit(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(LINE_LIMIT_MAX, Math.round(value)));
}

export interface EnhancerPreferences {
  accent: AccentPreset;
  uiFont: UiFontPreference;
  codeFont: CodeFontPreference;
  /** Independent scale factors (1 = 100%) for replies, tool UI and code. */
  replyScale: number;
  toolScale: number;
  codeScale: number;
  /** Multiplies the line height of assistant replies; 1 = 100%. Type size is `replyScale`. */
  replySpacing: number;
  /**
   * Lines of command output shown before the middle folds away, leaving the
   * start and the end. Zero shows all of it.
   */
  shellMaxLines: number;
  /** Lines of code, file reads and diffs shown before the rest folds. Zero shows all. */
  codeMaxLines: number;
  /** Lines of a prompt shown before the rest folds. Zero shows all. */
  promptMaxLines: number;
  /**
   * Draws an `http(s)` image a reply links without waiting for a click. The
   * agent writes the address, so a prompt injection can use it to send data off
   * the machine: off by default, and the reader's own risk when turned on.
   */
  loadRemoteImages: boolean;
  frostedGlass: boolean;
  /**
   * A light that follows the pointer across a card. Web and desktop only:
   * touch platforms have no hover, so the attribute is inert there.
   */
  pointerGlow: boolean;
  /**
   * Paseo maps a stream item to the plugin timeline item before any transformer
   * runs, and that mapping carries only the text. Pasted images therefore never
   * reach plugin code, so the enhanced bubble cannot draw them. Turning this off
   * hands prompts back to the host, whose own bubble still shows them.
   */
  enhancedUserBubble: boolean;
  /**
   * Folds a finished tool card back up on its own. A card the user opened or
   * closed keeps its state, and a failed call always stays open.
   */
  autoCollapseTools: boolean;
  /** Starts a thinking stream folded instead of following it live. */
  collapseThinking: boolean;
  /**
   * The Copy / Add to chat bar that follows a highlight. Web and desktop only:
   * iOS and Android route selection through the platform's own menu, which the
   * plugin cannot extend, so the toggle has no effect there.
   */
  selectionActions: boolean;
  /**
   * The plugin's own markdown rendering for assistant replies. Off hands the
   * turn back to Paseo's renderer, which is the safety valve: the plugin
   * cannot import the host markdown pipeline, so its version is a reasonable
   * subset rather than a superset.
   */
  assistantMarkdown: boolean;
  /** Which look the markdown renderer uses. */
  markdownVariant: MarkdownVariantPreference;
  /**
   * While Paseo's Chat display folds tool calls or whole turns, hands the rows
   * it needs back to the host. A plugin row is not a host `tool_call`, so the
   * host cannot count or fold it. Off keeps this plugin's cards in every mode.
   */
  yieldToHostFolding: boolean;
}

const STORAGE_KEY = "paseo/refined-chat/preferences/v1";

export const DEFAULT_PREFERENCES: Readonly<EnhancerPreferences> = {
  accent: "host",
  uiFont: "inter",
  codeFont: "code",
  replyScale: 1,
  toolScale: 1,
  codeScale: 1,
  replySpacing: 1,
  shellMaxLines: 20,
  codeMaxLines: 30,
  promptMaxLines: 15,
  loadRemoteImages: false,
  frostedGlass: true,
  pointerGlow: true,
  enhancedUserBubble: true,
  // Preserve Beautiful Chat's original behavior until explicitly enabled.
  autoCollapseTools: false,
  collapseThinking: false,
  selectionActions: true,
  assistantMarkdown: true,
  markdownVariant: "document",
  yieldToHostFolding: false,
};

const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  const candidate = globalThis as typeof globalThis & { localStorage?: Storage };
  return candidate.localStorage;
}

function isAccentPreset(value: unknown): value is AccentPreset {
  return typeof value === "string" && value in ACCENT_PRESETS;
}

function loadPreferences(): EnhancerPreferences {
  try {
    const stored = storage()?.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_PREFERENCES };
    const candidate = JSON.parse(stored) as Partial<EnhancerPreferences>;
    return {
      accent: isAccentPreset(candidate.accent) ? candidate.accent : DEFAULT_PREFERENCES.accent,
      uiFont: candidate.uiFont === "system" ? "system" : DEFAULT_PREFERENCES.uiFont,
      codeFont: candidate.codeFont === "plain" ? "plain" : DEFAULT_PREFERENCES.codeFont,
      replyScale: sanitizeTypographyScale(candidate.replyScale),
      toolScale: sanitizeTypographyScale(candidate.toolScale),
      codeScale: sanitizeTypographyScale(candidate.codeScale),
      replySpacing: sanitizeLineSpacing(candidate.replySpacing),
      shellMaxLines: sanitizeLineLimit(candidate.shellMaxLines, DEFAULT_PREFERENCES.shellMaxLines),
      codeMaxLines: sanitizeLineLimit(candidate.codeMaxLines, DEFAULT_PREFERENCES.codeMaxLines),
      promptMaxLines: sanitizeLineLimit(
        candidate.promptMaxLines,
        DEFAULT_PREFERENCES.promptMaxLines,
      ),
      // Only an explicit `true` counts: anything else stays the safe default.
      loadRemoteImages: candidate.loadRemoteImages === true,
      frostedGlass:
        typeof candidate.frostedGlass === "boolean"
          ? candidate.frostedGlass
          : DEFAULT_PREFERENCES.frostedGlass,
      pointerGlow:
        typeof candidate.pointerGlow === "boolean"
          ? candidate.pointerGlow
          : DEFAULT_PREFERENCES.pointerGlow,
      enhancedUserBubble:
        typeof candidate.enhancedUserBubble === "boolean"
          ? candidate.enhancedUserBubble
          : DEFAULT_PREFERENCES.enhancedUserBubble,
      autoCollapseTools:
        typeof candidate.autoCollapseTools === "boolean"
          ? candidate.autoCollapseTools
          : DEFAULT_PREFERENCES.autoCollapseTools,
      collapseThinking:
        typeof candidate.collapseThinking === "boolean"
          ? candidate.collapseThinking
          : DEFAULT_PREFERENCES.collapseThinking,
      selectionActions:
        typeof candidate.selectionActions === "boolean"
          ? candidate.selectionActions
          : DEFAULT_PREFERENCES.selectionActions,
      assistantMarkdown:
        typeof candidate.assistantMarkdown === "boolean"
          ? candidate.assistantMarkdown
          : DEFAULT_PREFERENCES.assistantMarkdown,
      markdownVariant:
        candidate.markdownVariant === "compact" || candidate.markdownVariant === "terminal"
          ? candidate.markdownVariant
          : DEFAULT_PREFERENCES.markdownVariant,
      yieldToHostFolding: candidate.yieldToHostFolding === true,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

let preferences = loadPreferences();

function publish(): void {
  for (const listener of listeners) listener();
}

export function getEnhancerPreferences(): EnhancerPreferences {
  return preferences;
}

export function updateEnhancerPreferences(update: Partial<EnhancerPreferences>): void {
  preferences = { ...preferences, ...update };
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Browser storage can be disabled. Keep the change alive for this session.
  }
  publish();
}

export function resetEnhancerPreferences(): void {
  preferences = { ...DEFAULT_PREFERENCES };
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Keep the default session value if storage is unavailable.
  }
  publish();
}

export function useEnhancerPreferences(): EnhancerPreferences {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getEnhancerPreferences,
    getEnhancerPreferences,
  );
}
