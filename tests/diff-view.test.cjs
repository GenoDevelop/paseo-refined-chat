const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, mocks = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("exports", "require", "module", js)(module.exports, name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith(".")) return load(path.resolve(path.dirname(file), name + ".ts"), mocks);
    return require(name);
  }, module);
  return module.exports;
}
const { sideBySideRows } = load(path.resolve(__dirname, "../client/components/diff-text.ts"));
const { fileHighlightLanguage } = load(path.resolve(__dirname, "../shared/highlight-languages.ts"));

test("Split diff pairs replacements, mirrors context, and leaves missing sides blank", () => {
  assert.deepEqual(sideBySideRows(["@@ -1,3 +1,4 @@", " context", "-old", "+new", "+extra", " end"]), [
    { header: 0 }, { old: 1, new: 1 }, { old: 2, new: 3 }, { old: undefined, new: 4 }, { old: 5, new: 5 },
  ]);
  assert.deepEqual(sideBySideRows(["--- a/x", "+++ b/x", "@@ -1 +1 @@", "-old", "+new", "@@ -9 +9 @@", "+added"]), [
    { header: 0 }, { header: 1 }, { header: 2 }, { old: 3, new: 4 }, { header: 5 }, { old: undefined, new: 6 },
  ]);
});

function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  return value && typeof value === "object" && value.props ? [value, ...nodes(value.props.children)] : [];
}
function renderer(result) {
  let state = [], cursor = 0, request;
  const fold = { folded: true, open: false, setOpen() {} };
  const mocks = {
    react: { useState: initial => { const i = cursor++; state[i] ??= initial; return [state[i], value => state[i] = value]; }, useMemo: fn => fn(), useCallback: fn => fn, useEffect() {} },
    "react-native": { View: "View", Text: "Text", Pressable: "Button", Modal: "Modal", ScrollView: "ScrollView", Platform: { OS: "web" }, StyleSheet: { create: x => x } },
    "@getpaseo/plugin/client/react-native": { copyText: async () => {} },
    "./markdown/link-style": {}, "./glyph": { Glyph: "Glyph" }, "./frosted": {}, "./view-props": { surfaceProps: () => ({}) }, "./glow": {}, "./motion": { Pop: "Pop" },
    "./theme-tokens": { radius: { card: 12, block: 8, chip: 5 } }, "./file-type-logo": { detectFileType: () => "generic", FileTypeLogo: "Logo" }, "./selection": {}, "./selection-actions": {},
    "../highlight": { useHighlightedLines: input => { request = input; return result; } }, "../output-paths": {}, "../fold": { planFold: () => ({ head: 1, hidden: 2 }), useFold: () => fold }, "./fold-bar": { FoldBar: "Fold" },
  };
  const { SyntaxHighlightBlock } = load(path.resolve(__dirname, "../client/components/syntax-highlight.tsx"), mocks);
  const tokens = { fs: x => x, syntax: {}, foreground: "neutral", surface0: "#181818", surface1: "rgba(255,255,255,0.03)" };
  return { request: () => request, render(props = {}) { cursor = 0; return SyntaxHighlightBlock({ code: "@@ -1 +1 @@\n-old\n+new", language: "diff", filename: "App.cs", tokens, ...props }); } };
}

test("Diff body keeps source tokens instead of monochrome diff tokens", () => {
  const ui = renderer({ lines: [[], [{ text: "-old", color: "all-red" }], [{ text: "+new", color: "all-green" }]], diffLines: [[], [{ text: "old", color: "keyword" }], [{ text: "new", color: "string" }]] });
  const first = ui.render();
  nodes(first).find(n => n.type === "Button" && n.props.accessibilityLabel === "Open fullscreen diff").props.onPress();
  const modal = nodes(ui.render()).find(n => n.type === "Modal");
  assert.equal(modal.props.children.props.style.backgroundColor, "#181818", "Fullscreen has an opaque theme base");
  assert.equal(nodes(modal).filter(n => n.type === "Button" && n.props.accessibilityLabel === "Close fullscreen diff").length, 1);
  assert.ok(!nodes(modal).some(n => n.props.dataSet?.ompfrost), "Fullscreen does not reuse a translucent frosted card");
  const colors = nodes(modal).flatMap(n => [].concat(n.props.style || []).map(s => s?.color));
  assert.ok(colors.includes("keyword")); assert.ok(colors.includes("string"));
  assert.ok(!colors.includes("all-red")); assert.ok(!colors.includes("all-green"));
  assert.equal(ui.request().diffBodyCode, "\nold\nnew");
  assert.ok(!nodes(modal).some(n => n.type === "Fold"));
  assert.ok(nodes(ui.render()).some(n => n.type === "Fold"), "Chat block remains folded behind fullscreen");
  modal.props.onRequestClose();
  assert.ok(!nodes(ui.render()).some(n => n.type === "Modal"));
});

test("Unknown files request neutral source tokens instead of falling back to diff grammar", () => {
  const ui = renderer({ lines: [[], [{ text: "-old", color: "all-red" }], [{ text: "+new", color: "all-green" }]], diffLines: [[], [{ text: "old", color: null }], [{ text: "new", color: null }]] });
  ui.render({ filename: "notes.unknown" });
  assert.equal(ui.request().diffBodyCode, "\nold\nnew");
});

test("Installed C#, Razor and Java grammars preserve multiple source colours", async () => {
  const { createHighlighterCore } = await import("@shikijs/core");
  const { createJavaScriptRegexEngine } = await import("@shikijs/engine-javascript");
  const highlighter = await createHighlighterCore({ themes: [import("@shikijs/themes/github-dark-default")],
    langs: [import("@shikijs/langs/csharp"), import("@shikijs/langs/razor"), import("@shikijs/langs/java")],
    engine: createJavaScriptRegexEngine({ forgiving: true }) });
  try {
    for (const [filename, code] of [["C:\\src\\App.CS", 'public string Name = "hello";'], ["Page.razor", '<h1 class="title">Hello</h1>'], ["Page.cshtml", '<div class="item">Text</div>'], ["App.java", 'public class App { String name = "hello"; }']]) {
      const lang = fileHighlightLanguage(filename);
      const { tokens } = highlighter.codeToTokens(code, { lang, theme: "github-dark-default" });
      assert.ok(new Set(tokens.flat().map(t => t.color)).size > 1, filename);
    }
    assert.equal(fileHighlightLanguage("unknown.blob"), null);
  } finally { highlighter.dispose(); }
});
