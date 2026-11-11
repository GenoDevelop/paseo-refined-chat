const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function comparison(rows, source, options = {}) {
  let selected = null;
  const loads = [];
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function("exports", "require", "module", js)(module.exports, name => {
      if (name === "react") return { useMemo: fn => fn(), useState: () => [selected, value => { selected = value; }] };
      if (name === "react-native") return { View: "View", Text: "Text", Pressable: "Button" };
      if (name === "./components/syntax-highlight") return { SyntaxHighlightBlock: "Diff" };
      if (name === "./conversation-history") return { useConversationHistory: agentId => {
        assert.equal(agentId, "agent-a");
        return { history: { rows, older: options.older, cursor: "older-cursor" }, loading: false,
          error: options.error || "", load: cursor => loads.push(cursor) };
      } };
      return name.startsWith(".") ? load(path.resolve(path.dirname(file), name + ".ts")) : require(name);
    }, module);
    return module.exports;
  }
  const { PlanComparison } = load(path.resolve(__dirname, "../client/plan-comparison.tsx"));
  return { loads, render: () => PlanComparison({ agentId: "agent-a", callId: "source", markdown: source,
    tokens: { fontUi: "sans", fs: value => value } }) };
}
const row = (seq, callId, text) => ({ seqStart: seq, seqEnd: seq, timestamp: "2026-11-11T12:00:00Z",
  item: { type: "tool_call", callId, name: "plan", status: "completed", detail: { type: "plan", text } } });
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  return value && typeof value === "object" && value.props ? [value, ...nodes(value.props.children)] : [];
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join("");
  return value && typeof value === "object" ? text(value.props?.children) : typeof value === "string" ? value : "";
}

test("Choosing another plan compares open source to selected target and excludes the source", () => {
  const ui = comparison([row(1, "source", "# Open plan\n\nOld step"), row(2, "target", "# New plan\n\nNew step")], "# Open plan\n\nOld step");
  const picker = ui.render();
  const choices = nodes(picker).filter(node => node.type === "Button");
  assert.equal(choices.length, 1);
  assert.match(text(choices[0]), /New plan/);
  choices[0].props.onPress();
  const result = ui.render();
  const diff = nodes(result).find(node => node.type === "Diff");
  assert.match(diff.props.code, /-Old step/);
  assert.match(diff.props.code, /\+New step/);
  assert.match(text(result), /From: Open plan/);
  assert.match(text(result), /To: New plan/);
});

test("Identical plans show no differences and the comparison can be changed", () => {
  const ui = comparison([row(2, "target", "# Same\n\nStep")], "# Same\n\nStep");
  nodes(ui.render()).find(node => node.type === "Button").props.onPress();
  const result = ui.render();
  assert.match(text(result), /No Markdown differences/);
  assert.equal(nodes(result).some(node => node.type === "Diff"), false);
  nodes(result).find(node => node.type === "Button" && /Choose another/.test(text(node))).props.onPress();
  assert.match(text(ui.render()), /Choose another plan from this conversation/);
});

test("Older plans are reachable and read failures offer retry", () => {
  const ui = comparison([], "# Source", { older: true, error: "Offline" });
  const result = ui.render();
  assert.match(text(result), /Offline/);
  nodes(result).find(node => node.type === "Button" && /Load earlier/.test(text(node))).props.onPress();
  nodes(result).find(node => node.type === "Button" && /Retry/.test(text(node))).props.onPress();
  assert.deepEqual(ui.loads, ["older-cursor", undefined]);
});
