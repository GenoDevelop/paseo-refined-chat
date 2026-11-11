const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function store() {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(require.resolve("../client/card-runs.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("exports", "require", "module", js)(module.exports, name => {
    if (name === "react") return { useRef: current => ({ current }), useEffect: effect => effect(), useSyncExternalStore: (_, read) => read() };
    return require(name);
  }, module);
  return module.exports;
}

test("Open and closed groups count plans separately from other tools", () => {
  const run = store();
  for (const [i, kind] of ["thinking", "plan", "other"].entries()) {
    run.useRunMember("agent", `row-${i}`, `call-${i}`, i * 3000, { kind, status: "done" }, true);
  }
  let view = run.freshView("agent", "row-0");
  assert.equal(view.summary, "1 plan, used 1 other tool, 1 thought");
  run.closeRun("row-0", view);
  view = run.freshView("agent", "row-0");
  assert.equal(view.closed, true);
  assert.equal(view.summary, "1 plan, used 1 other tool, 1 thought");
  run.openRun("row-0");
});

test("A failed plan follows the existing Other tools grouping preference", () => {
  for (const collapsed of [[], ["other"]]) {
    const run = store();
    run.useRunMember("agent", "thought", "call-thought", 0, { kind: "thinking", status: "done" }, true);
    run.useRunMember("agent", "plan", "call-plan", 3000, { kind: "plan", status: "failed" }, true);
    run.applyCollapseRule("thought", run.freshView("agent", "thought"), "finished", collapsed);
    assert.equal(run.freshView("agent", "thought").closed, collapsed.includes("other"));
    run.openRun("thought");
  }
});
