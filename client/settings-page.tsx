import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { COLLAPSE_KINDS, COLLAPSE_KIND_LABELS } from "./tool-collapse";
import type { CollapseKind } from "./tool-collapse";
import { Glyph } from "./components/glyph";
import { hostFontEscape } from "./components/host-font-escape";
import { radius, buildThemeTokens, type ExtendedThemeTokens } from "./components/theme-tokens";
import {
  ACCENT_PRESETS,
  LINE_LIMIT_MAX,
  TYPOGRAPHY_SCALE_MIN,
  TYPOGRAPHY_SCALE_MAX,
  LINE_SPACING_MIN,
  LINE_SPACING_MAX,
  resetEnhancerPreferences,
  updateEnhancerPreferences,
  useEnhancerPreferences,
  type AccentPreset,
  type CodeFontPreference,
  type UiFontPreference,
} from "./preferences";

const ACCENT_OPTIONS: ReadonlyArray<{
  id: AccentPreset;
  label: string;
  color: string | undefined;
}> = [
  { id: "host", label: "Host theme", color: undefined },
  { id: "jade", label: "Jade", color: ACCENT_PRESETS.jade },
  { id: "violet", label: "Violet", color: ACCENT_PRESETS.violet },
  { id: "amber", label: "Amber", color: ACCENT_PRESETS.amber },
  { id: "rose", label: "Rose", color: ACCENT_PRESETS.rose },
];

const TRACK_WIDTH = 38;
const TRACK_HEIGHT = 22;
const KNOB = 16;

/**
 * An on/off control that reads as one. A pair of buttons states the value
 * twice — the label and the selection — and a reader has to compare them to
 * learn which way it is set.
 */
function Toggle({
  value,
  onChange,
  label,
  tokens,
}: {
  value: boolean;
  onChange(next: boolean): void;
  label: string;
  tokens: ExtendedThemeTokens;
}) {
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.timing(position, {
      toValue: value ? 1 : 0,
      duration: 140,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [value, position]);

  return (
    <Pressable
      accessibilityRole="switch"
      // React Native Web does not map `accessibilityState.checked` onto a
      // Pressable, so the ARIA attribute is set directly as well.
      aria-checked={value}
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={[
        styles.track,
        {
          backgroundColor: value ? tokens.accent : tokens.surface2,
          borderColor: value ? tokens.accent : tokens.border,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.knob,
          {
            backgroundColor: value ? tokens.accentForeground : tokens.foregroundMuted,
            transform: [
              {
                translateX: position.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, TRACK_WIDTH - KNOB - 6],
                }),
              },
            ],
          },
        ]}
      />
    </Pressable>
  );
}

/** A row whose control is a toggle: text on the left, switch on the right. */
function ToggleRow({
  title,
  description,
  value,
  onChange,
  tokens,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange(next: boolean): void;
  tokens: ExtendedThemeTokens;
}) {
  return (
    <View style={[styles.row, styles.toggleRow, { borderTopColor: tokens.borderSubtle }]}>
      <View style={styles.toggleText}>
        <Text style={[styles.rowTitle, { color: tokens.foreground, fontFamily: tokens.fontUi }]}>
          {title}
        </Text>
        <Text
          style={[
            styles.rowDescription,
            { color: tokens.foregroundMuted, fontFamily: tokens.fontUi },
          ]}
        >
          {description}
        </Text>
      </View>
      <Toggle value={value} onChange={onChange} label={title} tokens={tokens} />
    </View>
  );
}

function OptionButton({
  label,
  selected,
  disabled = false,
  onPress,
  tokens,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress(): void;
  tokens: ExtendedThemeTokens;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.option,
        disabled && styles.dimmed,
        {
          backgroundColor: selected ? tokens.accentBg : tokens.surface2,
          borderColor: selected ? tokens.accent : tokens.borderSubtle,
        },
      ]}
    >
      <Text
        style={[
          styles.optionLabel,
          { color: selected ? tokens.accent : tokens.foregroundMuted, fontFamily: tokens.fontUi },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ChoiceRow<T extends string>({
  title,
  description,
  value,
  options,
  onChange,
  tokens,
}: {
  title: string;
  description: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange(value: T): void;
  tokens: ExtendedThemeTokens;
}) {
  return (
    <View style={[styles.row, { borderTopColor: tokens.borderSubtle }]}>
      <Text style={[styles.rowTitle, { color: tokens.foreground, fontFamily: tokens.fontUi }]}>
        {title}
      </Text>
      <Text
        style={[
          styles.rowDescription,
          { color: tokens.foregroundMuted, fontFamily: tokens.fontUi },
        ]}
      >
        {description}
      </Text>
      <View style={styles.options}>
        {options.map((option) => (
          <OptionButton
            key={option.value}
            label={option.label}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
            tokens={tokens}
          />
        ))}
      </View>
    </View>
  );
}

/** A row of independent choices, each switched on or off; the selected ones are active. */
function MultiChoiceRow<T extends string>({
  title,
  description,
  value,
  options,
  lockedValues = [],
  lockedHint,
  onChange,
  tokens,
}: {
  title: string;
  description: string;
  value: readonly T[];
  options: ReadonlyArray<{ value: T; label: string }>;
  /** Choices another setting already settles: shown dimmed and not selectable. */
  lockedValues?: readonly T[];
  lockedHint?: string;
  onChange(value: T[]): void;
  tokens: ExtendedThemeTokens;
}) {
  return (
    <View style={[styles.row, { borderTopColor: tokens.borderSubtle }]}>
      <Text style={[styles.rowTitle, { color: tokens.foreground, fontFamily: tokens.fontUi }]}>
        {title}
      </Text>
      <Text
        style={[
          styles.rowDescription,
          { color: tokens.foregroundMuted, fontFamily: tokens.fontUi },
        ]}
      >
        {description}
      </Text>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = value.includes(option.value);
          return (
            <OptionButton
              key={option.value}
              label={option.label}
              selected={selected}
              disabled={lockedValues.includes(option.value)}
              onPress={() =>
                onChange(
                  options
                    .map((entry) => entry.value)
                    .filter((entry) =>
                      entry === option.value ? !selected : value.includes(entry),
                    ),
                )
              }
              tokens={tokens}
            />
          );
        })}
      </View>
      {lockedHint && lockedValues.length > 0 ? (
        <Text
          style={[
            styles.rowDescription,
            { color: tokens.foregroundMuted, fontFamily: tokens.fontUi },
          ]}
        >
          {lockedHint}
        </Text>
      ) : null}
    </View>
  );
}

/** User-editable percent instead of fixed Small/Large presets. */
function PercentageRow({
  title,
  description,
  value,
  onChange,
  tokens,
  min = TYPOGRAPHY_SCALE_MIN,
  max = TYPOGRAPHY_SCALE_MAX,
}: {
  title: string;
  description: string;
  value: number;
  onChange(value: number): void;
  tokens: ExtendedThemeTokens;
  min?: number;
  max?: number;
}) {
  const format = (scale: number) => String(Math.round(scale * 10000) / 100);
  const [draft, setDraft] = useState(() => format(value));
  const [invalid, setInvalid] = useState(false);

  // A reset or a change from elsewhere should update the editor immediately.
  useEffect(() => {
    setDraft(format(value));
    setInvalid(false);
  }, [value]);

  function commit() {
    const input = draft.trim().replace(/%$/, "").trim().replace(",", ".");
    const percent = input ? Number(input) : NaN;
    if (
      !Number.isFinite(percent) ||
      percent < min * 100 ||
      percent > max * 100
    ) {
      setInvalid(true);
      return;
    }
    const next = Math.round(percent * 100) / 10000;
    setInvalid(false);
    setDraft(format(next));
    if (next !== value) onChange(next);
  }

  return (
    <View style={[styles.row, { borderTopColor: tokens.borderSubtle }]}>
      <Text style={[styles.rowTitle, { color: tokens.foreground, fontFamily: tokens.fontUi }]}>
        {title}
      </Text>
      <Text
        style={[
          styles.rowDescription,
          { color: tokens.foregroundMuted, fontFamily: tokens.fontUi },
        ]}
      >
        {description}
      </Text>
      <View style={styles.percentInputRow}>
        <TextInput
          value={draft}
          onChangeText={(next) => {
            setDraft(next);
            setInvalid(false);
          }}
          onBlur={commit}
          onSubmitEditing={commit}
          accessibilityLabel={title}
          accessibilityHint="Enter a percentage and press Enter to apply"
          keyboardType="decimal-pad"
          returnKeyType="done"
          maxLength={9}
          style={[
            styles.percentInput,
            {
              color: tokens.foreground,
              backgroundColor: tokens.surface2,
              borderColor: invalid ? tokens.danger : tokens.border,
              fontFamily: tokens.fontUi,
            },
          ]}
        />
        <Text style={[styles.percentUnit, { color: tokens.foreground, fontFamily: tokens.fontUi }]}>
          %
        </Text>
      </View>
      {invalid ? (
        <Text style={[styles.rowDescription, { color: tokens.danger }]}>
          Enter a value from {Math.round(min * 100)}% to {Math.round(max * 100)}%.
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A limit that can be switched off. Off is stored as zero, so saved settings
 * keep their meaning; switching on again restores the last number used.
 */
function LimitRow({
  title,
  description,
  value,
  fallback,
  unit = "lines",
  disabled = false,
  onChange,
  tokens,
}: {
  title: string;
  description: string;
  value: number;
  /** The number a switch-on uses when none was set this session. */
  fallback: number;
  unit?: string;
  /** Dimmed and inert when another setting makes this one moot. */
  disabled?: boolean;
  onChange(value: number): void;
  tokens: ExtendedThemeTokens;
}) {
  const [draft, setDraft] = useState(() => String(value));
  const [invalid, setInvalid] = useState(false);
  const lastOn = useRef(value > 0 ? value : fallback);
  if (value > 0) lastOn.current = value;

  useEffect(() => {
    setDraft(String(value));
    setInvalid(false);
  }, [value]);

  function commit() {
    const input = draft.trim();
    const lines = input ? Number(input) : NaN;
    if (!Number.isInteger(lines) || lines < 1 || lines > LINE_LIMIT_MAX) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(String(lines));
    if (lines !== value) onChange(lines);
  }

  const on = value > 0;
  return (
    <View
      style={[styles.row, { borderTopColor: tokens.borderSubtle }, disabled && styles.dimmed]}
      pointerEvents={disabled ? "none" : "auto"}
    >
      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={[styles.rowTitle, { color: tokens.foreground, fontFamily: tokens.fontUi }]}>
            {title}
          </Text>
          <Text
            style={[
              styles.rowDescription,
              { color: tokens.foregroundMuted, fontFamily: tokens.fontUi },
            ]}
          >
            {description}
          </Text>
        </View>
        <Toggle
          value={on}
          onChange={(next) => onChange(next ? lastOn.current : 0)}
          label={title}
          tokens={tokens}
        />
      </View>
      {on ? (
        <View style={styles.percentInputRow}>
          <TextInput
            value={draft}
            onChangeText={(next) => {
              setDraft(next);
              setInvalid(false);
            }}
            onBlur={commit}
            onSubmitEditing={commit}
            accessibilityLabel={`${title}: number of ${unit}`}
            accessibilityHint={`Enter a number of ${unit} and press Enter to apply`}
            keyboardType="number-pad"
            returnKeyType="done"
            maxLength={5}
            editable={!disabled}
            style={[
              styles.percentInput,
              {
                color: tokens.foreground,
                backgroundColor: tokens.surface2,
                borderColor: invalid ? tokens.danger : tokens.border,
                fontFamily: tokens.fontUi,
              },
            ]}
          />
          <Text style={[styles.percentUnit, { color: tokens.foreground, fontFamily: tokens.fontUi }]}>
            {unit}
          </Text>
        </View>
      ) : null}
      {invalid ? (
        <Text style={[styles.rowDescription, { color: tokens.danger }]}>
          Enter a whole number from 1 to {LINE_LIMIT_MAX}.
        </Text>
      ) : null}
    </View>
  );
}

const SECTIONS_KEY = "paseo/refined-chat/settings-sections/v1";

function readSectionState(): Record<string, boolean> {
  try {
    const stored = (globalThis as { localStorage?: Storage }).localStorage?.getItem(SECTIONS_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/**
 * A titled group of settings that folds. Whether it is open is remembered on
 * this client, apart from the settings themselves, so Reset defaults does not
 * rearrange the page.
 */
function Section({
  id,
  title,
  description,
  defaultOpen,
  tokens,
  children,
}: {
  id: string;
  title: string;
  description: string;
  defaultOpen: boolean;
  tokens: ExtendedThemeTokens;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => readSectionState()[id] ?? defaultOpen);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      (globalThis as { localStorage?: Storage }).localStorage?.setItem(
        SECTIONS_KEY,
        JSON.stringify({ ...readSectionState(), [id]: next }),
      );
    } catch {
      // Storage can be disabled: the section still folds for this session.
    }
  }

  return (
    <View
      style={[
        styles.card,
        { borderColor: tokens.borderSubtle, backgroundColor: tokens.surfaceGlass },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${open ? "collapse" : "expand"}`}
        onPress={toggle}
        style={styles.sectionHeader}
      >
        <View style={styles.sectionText}>
          <Text
            style={[styles.sectionTitle, { color: tokens.foreground, fontFamily: tokens.fontUi }]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.rowDescription,
              { color: tokens.foregroundMuted, fontFamily: tokens.fontUi },
            ]}
          >
            {description}
          </Text>
        </View>
        <Glyph name={open ? "ChevronUp" : "ChevronDown"} size={16} color={tokens.foregroundMuted} />
      </Pressable>
      {open ? children : null}
    </View>
  );
}

/** Settings content mounted by Paseo under the selected host's Plugin settings. */
export function BeautifulChatSettingsPage({ theme }: PluginSurfaceProps) {
  const preferences = useEnhancerPreferences();
  const tokens = useMemo(
    () => buildThemeTokens(theme.colors, preferences),
    [preferences, theme.colors],
  );

  return (
    <View {...hostFontEscape} style={[styles.container, { backgroundColor: tokens.surface0 }]}>
      <View
        style={[
          styles.intro,
          { borderColor: tokens.borderSubtle, backgroundColor: tokens.surface1 },
        ]}
      >
        <Text style={[styles.title, { color: tokens.foreground, fontFamily: tokens.fontUi }]}>
          Refined Chat presentation
        </Text>
        <Text
          style={[styles.description, { color: tokens.foregroundMuted, fontFamily: tokens.fontUi }]}
        >
          Changes apply to every enhanced tool call, reasoning trace, checklist, and prompt in this
          client.
        </Text>
      </View>

      <Section
        id="appearance"
        title="Appearance"
        description="Colour, fonts and surfaces."
        defaultOpen={true}
        tokens={tokens}
      >
        <View style={[styles.row, { borderTopColor: tokens.borderSubtle }]}>
          <Text style={[styles.rowTitle, { color: tokens.foreground, fontFamily: tokens.fontUi }]}>
            Accent colour
          </Text>
          <Text
            style={[
              styles.rowDescription,
              { color: tokens.foregroundMuted, fontFamily: tokens.fontUi },
            ]}
          >
            Use the current Paseo theme, or choose a presentation accent.
          </Text>
          <View style={styles.accentOptions}>
            {ACCENT_OPTIONS.map((option) => {
              const selected = preferences.accent === option.id;
              const swatch = option.color ?? theme.colors.accent;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Accent: ${option.label}`}
                  accessibilityState={{ selected }}
                  onPress={() => updateEnhancerPreferences({ accent: option.id })}
                  style={[
                    styles.accentOption,
                    {
                      borderColor: selected ? tokens.accent : tokens.borderSubtle,
                      backgroundColor: selected ? tokens.accentBg : tokens.surface2,
                    },
                  ]}
                >
                  <View style={[styles.swatch, { backgroundColor: swatch }]} />
                  <Text
                    style={[
                      styles.accentLabel,
                      {
                        color: selected ? tokens.accent : tokens.foregroundMuted,
                        fontFamily: tokens.fontUi,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ChoiceRow<UiFontPreference>
          title="Interface font"
          description="Choose the embedded Inter face or the system interface face."
          value={preferences.uiFont}
          options={[
            { value: "inter", label: "Inter" },
            { value: "system", label: "System" },
          ]}
          onChange={(uiFont) => updateEnhancerPreferences({ uiFont })}
          tokens={tokens}
        />

        <ChoiceRow<CodeFontPreference>
          title="Code glyphs"
          description="Use programming ligatures inside syntax blocks, or keep every code glyph literal."
          value={preferences.codeFont}
          options={[
            { value: "code", label: "Ligatures" },
            { value: "plain", label: "Literal" },
          ]}
          onChange={(codeFont) => updateEnhancerPreferences({ codeFont })}
          tokens={tokens}
        />

        <ToggleRow
          title="Frosted glass"
          description="Blur surfaces where the host supports it, or use solid surfaces instead."
          value={preferences.frostedGlass}
          onChange={(frostedGlass) => updateEnhancerPreferences({ frostedGlass })}
          tokens={tokens}
        />

        <ToggleRow
          title="Pointer glow"
          description="A soft light follows the pointer across each card. Desktop and web only: touch platforms have no hover, and the light is skipped when the system asks for reduced motion."
          value={preferences.pointerGlow}
          onChange={(pointerGlow) => updateEnhancerPreferences({ pointerGlow })}
          tokens={tokens}
        />
      </Section>
      <Section
        id="sizes"
        title="Text size and spacing"
        description="How large text is drawn, as a percentage of the default."
        defaultOpen={true}
        tokens={tokens}
      >
        <PercentageRow
          title="Assistant replies"
          description="Body text, headings, lists and spacing in markdown. Enter any percent, e.g. 127.5."
          value={preferences.replyScale}
          onChange={(replyScale) => updateEnhancerPreferences({ replyScale })}
          tokens={tokens}
        />

        <PercentageRow
          title="Reply line spacing"
          description="Height of each line in assistant replies, independent of the text size above. 100% is the default; 80% to 200%."
          value={preferences.replySpacing}
          onChange={(replySpacing) => updateEnhancerPreferences({ replySpacing })}
          tokens={tokens}
          min={LINE_SPACING_MIN}
          max={LINE_SPACING_MAX}
        />

        <PercentageRow
          title="Tool cards"
          description="Tool headers, metadata, reasoning, status messages and checklists."
          value={preferences.toolScale}
          onChange={(toolScale) => updateEnhancerPreferences({ toolScale })}
          tokens={tokens}
        />

        <PercentageRow
          title="Code and terminal"
          description="Fenced code, diffs, line numbers, terminal and other code output. Inline code follows replies."
          value={preferences.codeScale}
          onChange={(codeScale) => updateEnhancerPreferences({ codeScale })}
          tokens={tokens}
        />
      </Section>
      <Section
        id="replies"
        title="Replies and prompts"
        description="How your prompts and the assistant's answers are drawn."
        defaultOpen={true}
        tokens={tokens}
      >
        <ToggleRow
          title="Assistant markdown"
          description="Draws the reply with the plugin's own headings, lists and syntax-highlighted code blocks. The plugin cannot reach Paseo's markdown pipeline, so its version is a subset: turn this off for mermaid diagrams, images, and the host's file-path links."
          value={preferences.assistantMarkdown}
          onChange={(assistantMarkdown) => updateEnhancerPreferences({ assistantMarkdown })}
          tokens={tokens}
        />

        <ChoiceRow
          title="Markdown style"
          description="Document is airy and built for long answers. Compact tightens the spacing for short replies. Terminal sets the body in the code face."
          value={preferences.markdownVariant}
          options={[
            { value: "document", label: "Document" },
            { value: "compact", label: "Compact" },
            { value: "terminal", label: "Terminal" },
          ]}
          onChange={(markdownVariant) => updateEnhancerPreferences({ markdownVariant })}
          tokens={tokens}
        />

        <ToggleRow
          title="Enhanced prompt bubble"
          description="Paseo removes pasted images before a plugin sees the message, so the enhanced bubble cannot show them. Turn this off for Paseo's own bubble with image previews. New prompts follow the change."
          value={preferences.enhancedUserBubble}
          onChange={(enhancedUserBubble) => updateEnhancerPreferences({ enhancedUserBubble })}
          tokens={tokens}
        />

        <ToggleRow
          title="Selection actions"
          description="Highlighting text in a callout raises a small bar with Copy and Add to chat. Add to chat drops the highlight into the composer as a quote, or a fenced block when it came from code. Desktop and web only: iOS and Android use the platform's own selection menu."
          value={preferences.selectionActions}
          onChange={(selectionActions) => updateEnhancerPreferences({ selectionActions })}
          tokens={tokens}
        />
      </Section>
      <Section
        id="tools"
        title="Tool card folding"
        description="Which cards fold, and when."
        defaultOpen={true}
        tokens={tokens}
      >
        <MultiChoiceRow<CollapseKind>
          title="Cards that start collapsed"
          description="Drawn folded from the start, even while still running, and open to read. Independent of folding on finish. A failed call stays folded too; its exit code and status show in the header."
          value={preferences.startCollapsedKinds}
          options={COLLAPSE_KINDS.map((kind) => ({ value: kind, label: COLLAPSE_KIND_LABELS[kind] }))}
          onChange={(startCollapsedKinds) => updateEnhancerPreferences({ startCollapsedKinds })}
          tokens={tokens}
        />

        <MultiChoiceRow<CollapseKind>
          title="Cards to collapse when finished"
          description="Cards that fold back up once they finish; none selected turns folding off. A failed call and an ask card stay open, and a card you opened or closed yourself keeps its state. Thinking stays open while it streams, then folds."
          value={preferences.autoCollapseKinds}
          options={COLLAPSE_KINDS.map((kind) => ({ value: kind, label: COLLAPSE_KIND_LABELS[kind] }))}
          lockedValues={preferences.startCollapsedKinds}
          lockedHint="Dimmed kinds already start collapsed, so there is nothing to fold."
          onChange={(autoCollapseKinds) => updateEnhancerPreferences({ autoCollapseKinds })}
          tokens={tokens}
        />

        <LimitRow
          title="Only fold longer cards"
          description="Leaves a tool card open on finish while its output, code and diff total fewer lines than this. Off folds every selected card."
          value={preferences.autoCollapseMinLines}
          fallback={10}
          disabled={
            preferences.autoCollapseKinds.every((kind) => preferences.startCollapsedKinds.includes(kind))
          }
          onChange={(autoCollapseMinLines) => updateEnhancerPreferences({ autoCollapseMinLines })}
          tokens={tokens}
        />
      </Section>
      <Section
        id="limits"
        title="Long content"
        description="Past this many lines, output, code and prompts fold behind a control."
        defaultOpen={true}
        tokens={tokens}
      >
        <LimitRow
          title="Long terminal output"
          description="Text results (command output, errors, eval output, GitHub replies) past this many lines keep their start and their end and fold the middle. Off never folds."
          fallback={20}
          value={preferences.shellMaxLines}
          onChange={(shellMaxLines) => updateEnhancerPreferences({ shellMaxLines })}
          tokens={tokens}
        />

        <LimitRow
          title="Long code and diffs"
          description="File reads, writes, diffs, structured data (MCP, GitHub, eval code) and code blocks in replies past this many lines show the first lines and fold the rest. Off never folds."
          fallback={30}
          value={preferences.codeMaxLines}
          onChange={(codeMaxLines) => updateEnhancerPreferences({ codeMaxLines })}
          tokens={tokens}
        />

        <LimitRow
          title="Long prompts"
          description="A prompt you wrote past this many lines shows its first lines and folds the rest, in this plugin's prompt bubble only. A long paragraph with no line breaks counts by about 70 characters a line. Off never folds."
          fallback={15}
          value={preferences.promptMaxLines}
          onChange={(promptMaxLines) => updateEnhancerPreferences({ promptMaxLines })}
          tokens={tokens}
        />
      </Section>
      <Section
        id="advanced"
        title="Advanced"
        description="Safety and host integration. Most readers never need these."
        defaultOpen={false}
        tokens={tokens}
      >
        <ToggleRow
          title="Load remote images automatically (at your own risk)"
          description="Off: an image an agent links over http(s) waits behind a Load button that names the server. On: it loads without asking. The agent writes the address, so a prompt injection can make your machine request a URL that carries data from the chat, and the server sees your IP address. Turn this on only if you accept that."
          value={preferences.loadRemoteImages}
          onChange={(loadRemoteImages) => updateEnhancerPreferences({ loadRemoteImages })}
          tokens={tokens}
        />

        <ToggleRow
          title="Let Paseo fold tool calls and turns"
          description="Only acts when Paseo's Chat display is Collapse tool calls or Collapse turns. Paseo can fold only its own rows, so with this on, tool calls and reasoning (and, for Collapse turns, prompts and replies, which then ignore the reply size and spacing set here) are drawn by Paseo instead of this plugin. Off keeps this plugin's cards in every mode, and Paseo does not fold them. Rows are drawn once when they load, so after changing this or Paseo's Chat display, reload the plugin or restart the app."
          value={preferences.yieldToHostFolding}
          onChange={(yieldToHostFolding) => updateEnhancerPreferences({ yieldToHostFolding })}
          tokens={tokens}
        />
      </Section>

      <Pressable
        accessibilityRole="button"
        onPress={resetEnhancerPreferences}
        style={[styles.reset, { borderColor: tokens.borderSubtle }]}
      >
        <Text
          style={[styles.resetText, { color: tokens.foregroundMuted, fontFamily: tokens.fontUi }]}
        >
          Reset defaults
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // No `flex: 1` here. The host mounts a settings screen inside a plain
  // column `View` (app `plugins/settings/index.tsx:107`), and React Native Web
  // compiles `flex: 1` to `flex: 1 1 0%` — a zero basis in a container that
  // sizes to its content, so the whole page collapses to nothing.
  container: { alignSelf: "stretch", padding: 16, gap: 12 },
  dimmed: { opacity: 0.4 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  // The text column takes the slack so a long description wraps instead of
  // pushing the switch off the card.
  toggleText: { flex: 1, minWidth: 0, gap: 8 },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 1,
    padding: 2,
    justifyContent: "center",
  },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2 },
  intro: { padding: 14, borderWidth: 1, borderRadius: radius.card, gap: 4 },
  title: { fontSize: 16, fontWeight: "700" },
  description: { fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: radius.card, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  sectionText: { flex: 1, minWidth: 0, gap: 3 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  row: { padding: 14, gap: 8, borderTopWidth: 1 },
  rowTitle: { fontSize: 14, fontWeight: "600" },
  rowDescription: { fontSize: 12, lineHeight: 17 },
  percentInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  percentInput: {
    minWidth: 94,
    height: 38,
    borderWidth: 1,
    borderRadius: radius.block,
    paddingHorizontal: 10,
    fontSize: 15,
    textAlign: "right",
  },
  percentUnit: { fontSize: 14, fontWeight: "600" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { borderWidth: 1, borderRadius: radius.block, paddingHorizontal: 10, paddingVertical: 7 },
  optionLabel: { fontSize: 12, fontWeight: "600" },
  accentOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  accentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.block,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  swatch: { width: 12, height: 12, borderRadius: radius.chip },
  accentLabel: { fontSize: 12, fontWeight: "600" },
  reset: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.block,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  resetText: { fontSize: 12, fontWeight: "600" },
});
