const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const moduleUnderTest = { exports: {} };
const js = ts.transpileModule(fs.readFileSync(require.resolve("../client/components/ios-selectable-prose.tsx"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
new Function("exports", "require", "module", js)(moduleUnderTest.exports, name => name === "react/jsx-runtime" ? require(name) : {}, moduleUnderTest);
const { findNativeProse } = moduleUnderTest.exports;
test("Clipboard notifications reset every selection without reading contents or menu labels", () => {
  const { subscribeClipboardSelectionReset, clipboardSelectionSnapshot } = moduleUnderTest.exports;
  const previous = globalThis.expo;
  let event, changed, registrations = 0, removals = 0, first = 0, second = 0;
  globalThis.expo = { modules: { ExpoClipboard: {
    addListener(name, callback) { registrations++; event = name; changed = callback; return { remove() { removals++; } }; },
    getStringAsync() { throw new Error("Must not read clipboard contents"); },
  } } };
  try {
    const stopFirst = subscribeClipboardSelectionReset(() => first++);
    const stopSecond = subscribeClipboardSelectionReset(() => second++);
    assert.equal(registrations, 1);
    assert.equal(event, "onClipboardChanged");
    const before = clipboardSelectionSnapshot();
    changed();
    assert.equal(clipboardSelectionSnapshot(), before + 1);
    assert.equal(first, 1); assert.equal(second, 1);
    stopFirst(); assert.equal(removals, 0);
    stopSecond(); assert.equal(removals, 1);
  } finally { globalThis.expo = previous; }
  const stopUnavailable = subscribeClipboardSelectionReset(() => {});
  stopUnavailable();
});
test("Paragraphs containing formatting and inline code remain eligible for selection", () => {
  const { selectableProseMarkdown } = moduleUnderTest.exports;
  assert.equal(selectableProseMarkdown([
    { kind: "text", text: "Dev (" }, { kind: "codeSpan", text: "running" }, { kind: "text", text: ")." },
  ]), "Dev \\(` running `\\)\\.");
  assert.equal(selectableProseMarkdown([{ kind: "strong", spans: [{ kind: "emphasis", spans: [{ kind: "text", text: "Ready" }] }] }]), "***Ready***");
  assert.equal(selectableProseMarkdown([{ kind: "codeSpan", text: "a`b" }]), "`` a`b ``");
  assert.equal(selectableProseMarkdown([{ kind: "codeSpan", text: "src/app.ts" }]), null);
  assert.equal(selectableProseMarkdown([{ kind: "link", href: "https://example.com", spans: [] }]), null);
});
test("Probe captures only its native subtree, retaining its schema but no host event handlers", () => {
  const props = { markdown: "Selection probe", markdownStyle: { paragraph: { color: "black" } }, selectable: true,
    onLinkPress() {}, onLayout() {}, children: "private", nativeID: "host-id" };
  const Wrapper = () => null;
  const found = findNativeProse({ child: { type: () => {}, child: { type: Wrapper, memoizedProps: props } } });
  assert.equal(found.type, Wrapper);
  assert.equal(findNativeProse({ child: { type: "EnrichedMarkdown", memoizedProps: props } }), null, "Do not clone native leaves that require generated block slots");
  assert.equal(found.props.markdownStyle, props.markdownStyle);
  assert.equal(found.props.selectable, true);
  assert.ok(!("onLinkPress" in found.props));
  assert.ok(!("children" in found.props));
  assert.equal(findNativeProse({ sibling: { type: Wrapper, memoizedProps: props } }), null);
  const cycle = {}; cycle.child = cycle;
  assert.equal(findNativeProse(cycle), null);
});
