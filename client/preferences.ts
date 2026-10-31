import { useSyncExternalStore } from "react";
import { COLLAPSE_KINDS, sanitizeCollapseKinds } from "./tool-collapse";
import type { CollapseKind } from "./tool-collapse";

/**
 * One palette behind every colour setting, so a name means the same colour
 * wherever it is chosen. These are the soft pastel steps: they read as text on
 * a dark surface and as a highlighter wash on any surface.
 */
export const PALETTE = {
  rose: "#fda4af",
  orange: "#fdba74",
  yellow: "#fde047",
  green: "#86efac",
  sky: "#7dd3fc",
  violet: "#c4b5fd",
} as const;

/** The same names a step deeper, for text on a light surface where pastel would vanish. */
const PALETTE_DEEP: Readonly<Record<keyof typeof PALETTE, string>> = {
  rose: "#e11d48",
  orange: "#ea580c",
  yellow: "#ca8a04",
  green: "#16a34a",
  sky: "#0284c7",
  violet: "#7c3aed",
};

export type PaletteColor = keyof typeof PALETTE;

/** A palette colour, the hex the reader chose, or the setting's own extra. */
export type AccentChoice = PaletteColor | "host" | "custom";
export type BoldColorChoice = PaletteColor | "inherit" | "custom";
export type MarkColorChoice = PaletteColor | "custom";

/** Colour ids from before the shared palette, mapped to their closest successor. */
const LEGACY_COLOURS: Readonly<Record<string, PaletteColor>> = {
  jade: "green",
  amber: "yellow",
  blue: "sky",
  mint: "green",
  peach: "orange",
};

/** The colour of text drawn in a choice, given the hex kept for Custom. */
export function paletteHex(
  choice: PaletteColor | "custom",
  custom: string,
  isDark: boolean,
): string {
  if (choice === "custom") return custom;
  return isDark ? PALETTE[choice] : PALETTE_DEEP[choice];
}

export type UiFontPreference = "inter" | "system";
export type CodeFontPreference = "code" | "plain";
/** Which family draws monospace text: the embedded Iosevka, Paseo's own Code font, or a named one. */
export type MonoFontPreference = "iosevka" | "paseo" | "custom";
/** Where pressing a file path in a reply shows the file: a side panel, or the file manager. */
export type PathOpensPreference = "panel" | "manager";
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
  accent: AccentChoice;
  /** The hex used when `accent` is `custom`; kept while a preset is chosen. */
  accentCustomColor: string;
  boldColor: BoldColorChoice;
  boldCustomColor: string;
  uiFont: UiFontPreference;
  codeFont: CodeFontPreference;
  monoFont: MonoFontPreference;
  /** The family used when `monoFont` is `custom`; kept while another choice is active. */
  monoCustomFont: string;
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
   * Which cards fold back up on their own once they finish; none turns the
   * folding off. A card the user opened or closed keeps its state, and a failed
   * call always stays open.
   */
  autoCollapseKinds: CollapseKind[];
  /**
   * A finished card with fewer lines than this stays open, since reopening it
   * would cost a click for almost nothing. Zero folds every card.
   */
  autoCollapseMinLines: number;
  /**
   * Cards drawn folded from the start, even while their call still runs and
   * if it fails. Unlike `autoCollapseKinds`, which folds a card
   * once it finishes, this keeps it closed throughout.
   */
  startCollapsedKinds: CollapseKind[];
  /**
   * The Copy / Add to chat bar that follows a highlight. Web and desktop only:
   * iOS and Android route selection through the platform's own menu, which the
   * plugin cannot extend, so the toggle has no effect there.
   */
  selectionActions: boolean;
  pathOpens: PathOpensPreference;
  /** Draw `==text==` in a reply as a highlighter mark. */
  highlightMarks: boolean;
  markColor: MarkColorChoice;
  markCustomColor: string;
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
  accentCustomColor: "#6366f1",
  boldColor: "inherit",
  boldCustomColor: "#e64980",
  uiFont: "inter",
  codeFont: "code",
  monoFont: "iosevka",
  monoCustomFont: "",
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
  autoCollapseKinds: [],
  autoCollapseMinLines: 0,
  startCollapsedKinds: [],
  selectionActions: true,
  pathOpens: "panel",
  highlightMarks: false,
  markColor: "yellow",
  markCustomColor: "#eab308",
  assistantMarkdown: true,
  markdownVariant: "document",
  yieldToHostFolding: false,
};

const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  const candidate = globalThis as typeof globalThis & { localStorage?: Storage };
  return candidate.localStorage;
}

function sanitizeColourChoice<T extends string>(
  value: unknown,
  extras: readonly string[],
  fallback: T,
): T {
  if (typeof value !== "string") return fallback;
  const name = LEGACY_COLOURS[value] ?? value;
  return name === "custom" || name in PALETTE || extras.includes(name) ? (name as T) : fallback;
}

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Keeps a stored hex well-formed; anything else falls back. */
function sanitizeHex(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value.toLowerCase() : fallback;
}

/**
 * Reads the kinds that fold on finishing, carrying over the "Auto-collapse
 * tools" switch this list replaced: off meant no folding, on meant every kind.
 */
function loadAutoCollapseKinds(
  candidate: Partial<EnhancerPreferences> & { autoCollapseTools?: unknown },
): CollapseKind[] {
  if (candidate.autoCollapseTools === false) return [];
  if (Array.isArray(candidate.autoCollapseKinds)) {
    return sanitizeCollapseKinds(candidate.autoCollapseKinds, []);
  }
  return candidate.autoCollapseTools === true ? [...COLLAPSE_KINDS] : [];
}

/**
 * Reads the start-collapsed kinds, carrying over the two switches this list
 * replaced: "Collapse thinking" and "Open while running".
 */
function loadStartCollapsedKinds(
  candidate: Partial<EnhancerPreferences> & { collapseThinking?: unknown; openWhileRunning?: unknown },
): CollapseKind[] {
  if (Array.isArray(candidate.startCollapsedKinds)) {
    return sanitizeCollapseKinds(candidate.startCollapsedKinds, []);
  }
  const legacy: CollapseKind[] = [];
  if (candidate.openWhileRunning === false) {
    legacy.push(...COLLAPSE_KINDS.filter((kind) => kind !== "thinking"));
  }
  if (candidate.collapseThinking === true) legacy.push("thinking");
  return legacy;
}

/**
 * One family name, as typed. The name ends up inside a CSS declaration, so
 * everything that could close it, start another or add a second family is dropped.
 */
export function sanitizeFontFamily(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[<>{}();,"'\\\r\n]/g, "").trim().slice(0, 80);
}

function loadPreferences(): EnhancerPreferences {
  try {
    const stored = storage()?.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_PREFERENCES };
    const candidate = JSON.parse(stored) as Partial<EnhancerPreferences>;
    return {
      accent: sanitizeColourChoice(candidate.accent, ["host"], DEFAULT_PREFERENCES.accent),
      accentCustomColor: sanitizeHex(
        candidate.accentCustomColor,
        DEFAULT_PREFERENCES.accentCustomColor,
      ),
      boldColor: sanitizeColourChoice(
        candidate.boldColor,
        ["inherit"],
        DEFAULT_PREFERENCES.boldColor,
      ),
      boldCustomColor: sanitizeHex(candidate.boldCustomColor, DEFAULT_PREFERENCES.boldCustomColor),
      uiFont: candidate.uiFont === "system" ? "system" : DEFAULT_PREFERENCES.uiFont,
      codeFont: candidate.codeFont === "plain" ? "plain" : DEFAULT_PREFERENCES.codeFont,
      monoFont:
        candidate.monoFont === "paseo" || candidate.monoFont === "custom"
          ? candidate.monoFont
          : DEFAULT_PREFERENCES.monoFont,
      monoCustomFont: sanitizeFontFamily(candidate.monoCustomFont),
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
      autoCollapseKinds: loadAutoCollapseKinds(candidate),
      autoCollapseMinLines: sanitizeLineLimit(
        candidate.autoCollapseMinLines,
        DEFAULT_PREFERENCES.autoCollapseMinLines,
      ),
      startCollapsedKinds: loadStartCollapsedKinds(candidate),
      selectionActions:
        typeof candidate.selectionActions === "boolean"
          ? candidate.selectionActions
          : DEFAULT_PREFERENCES.selectionActions,
      pathOpens: candidate.pathOpens === "manager" ? "manager" : DEFAULT_PREFERENCES.pathOpens,
      highlightMarks:
        typeof candidate.highlightMarks === "boolean"
          ? candidate.highlightMarks
          : DEFAULT_PREFERENCES.highlightMarks,
      markColor: sanitizeColourChoice(candidate.markColor, [], DEFAULT_PREFERENCES.markColor),
      markCustomColor: sanitizeHex(candidate.markCustomColor, DEFAULT_PREFERENCES.markCustomColor),
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
