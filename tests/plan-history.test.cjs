const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const path = require("node:path");

function load(file) {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("exports", "require", "module", js)(module.exports, name => {
    if (name === "react" || name === "@getpaseo/plugin/client") return {};
    return name.startsWith(".") ? load(path.resolve(path.dirname(file), name + ".ts")) : require(name);
  }, module);
  return module.exports;
}

// Exercise the renderer's real identity expression, including its old broken
// form, without mocking every hook and presentation component of the renderer.
function rendererId() {
  const source = ts.createSourceFile("renderer.tsx", fs.readFileSync(require.resolve("../client/live-renderers.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isObjectLiteralExpression(node) && node.properties.some(p => p.name?.getText(source) === "tool" && p.initializer?.getText(source) === "toolKind")) {
      expression = node.properties.find(p => p.name?.getText(source) === "id").initializer.getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(expression);
  return new Function("data", "runKey", "rawName", `return (${expression});`);
}

test("Two mounted plans converge instead of repeatedly invalidating the conversation", () => {
  const id = rendererId();
  const { rememberPlan, onPlanHistoryChange } = load(require.resolve("../client/plan-history.ts"));
  let changes = 0;
  onPlanHistoryChange(() => changes++);
  for (let projection = 0; projection < 5; projection++) {
    for (const callId of ["first-plan", "latest-plan"]) {
      rememberPlan("architecture", id({ callId }, `tool:${callId}:1000`, "plan"), { text: `# ${callId}`, decision: "proposed" });
    }
  }
  assert.equal(changes, 2, "Reprojection must not replace one plan with another under the same cache key");
  assert.equal(id({ callId: "latest-plan" }, "fallback", "plan"), "latest-plan", "Comparison uses the original timeline call ID");
  assert.notEqual(id({}, "row-one", "plan"), id({}, "row-two", "plan"));
});
