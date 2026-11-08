const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const source = fs.readFileSync(require.resolve("../client/tool-collapse.ts"), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = { exports: {} };
new Function("exports", "require", "module", js)(loaded.exports, require, loaded);
const { collapseKind, sanitizeCollapseKinds, shouldAutoCollapse, cardLineCount, startsExpanded } = loaded.exports;
const question = {
  question: "Colour?", multiple: false,
  options: [{ id: "a", label: "Purple" }, { id: "b", label: "Green" }], answers: ["Purple"],
};
const card = { tool: "ask", status: "completed", askQuestions: [question], output: "Raw duplicate\nnot counted" };

test("Completed ask cards mount open unless ask explicitly starts collapsed", () => {
  assert.equal(startsExpanded(card, []), true);
  assert.equal(startsExpanded(card, ["other"]), true);
  assert.equal(startsExpanded(card, ["ask"]), false);
  assert.equal(startsExpanded({ ...card, status: "running" }, ["ask"]), false);
  assert.equal(startsExpanded({ ...card, status: "failed" }, ["ask"]), false);
  assert.equal(startsExpanded({ tool: "read", status: "completed" }, []), false);
  assert.equal(startsExpanded({ tool: "read", status: "running" }, []), true);
  assert.equal(startsExpanded({ tool: "read", status: "failed" }, []), true);
});

test("Ask is independently selectable and no longer belongs to Other tools", () => {
  assert.equal(collapseKind("ask"), "ask");
  assert.equal(collapseKind("unknown-tool"), "other");
  assert.deepEqual(sanitizeCollapseKinds(["ask", "ask", "other", "invalid"], []), ["ask", "other"]);
  assert.equal(shouldAutoCollapse(card, { kinds: ["other"], minLines: 0 }), false);
  assert.equal(shouldAutoCollapse(card, { kinds: ["ask"], minLines: 0 }), true);
});

test("Ask waits for all answers and preserves failed and running cards", () => {
  const rules = { kinds: ["ask"], minLines: 0 };
  assert.equal(shouldAutoCollapse({ ...card, status: "running" }, rules), false);
  assert.equal(shouldAutoCollapse({ ...card, status: "failed" }, rules), false);
  assert.equal(shouldAutoCollapse({ ...card, askQuestions: [{ ...question, answers: [] }] }, rules), false);
  assert.equal(shouldAutoCollapse({ ...card, askQuestions: [question, { ...question, answers: [] }] }, rules), false);
  assert.equal(shouldAutoCollapse({ ...card, askQuestions: undefined }, rules), false);
});

test("Ask respects the length threshold without counting duplicate raw output", () => {
  assert.equal(cardLineCount(card), 4);
  assert.equal(shouldAutoCollapse(card, { kinds: ["ask"], minLines: 5 }), false);
  assert.equal(shouldAutoCollapse(card, { kinds: ["ask"], minLines: 4 }), true);
  assert.equal(shouldAutoCollapse({ tool: "shell", status: "completed", output: "one\ntwo" },
    { kinds: ["shell"], minLines: 2 }), true);
});
