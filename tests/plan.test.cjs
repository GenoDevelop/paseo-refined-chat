const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const compiled = ts.transpileModule(fs.readFileSync(require.resolve("../client/plan.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = { exports: {} };
new Function("exports", "require", "module", compiled)(loaded.exports, require, loaded);
const { parsePlan, planTitle, isPlanImplementation, PLAN_PROMPT_PREFIX } = loaded.exports;
const markdown = "# Plan\n\n- First step\n\n```ts\nconst ready = true;\n```\n";
const detail = { type: "plan", text: markdown };

test("Claude ExitPlanMode renders while pending and follows the same call through resolution", () => {
  for (const name of ["ExitPlanMode", "exitplanmode"]) {
    assert.deepEqual(parsePlan(name, detail, {}, "running"), { text: markdown, decision: "pending" });
  }
  assert.equal(parsePlan("plan_approval", detail, { approved: true }, "completed").decision, "approved");
  assert.equal(parsePlan("plan_approval", detail, { approved: false }, "completed").decision, "rejected");
  assert.equal(parsePlan("ExitPlanMode", { type: "plain_text", text: markdown }, {}, "running"), undefined);
});

test("Uses the plan heading as the card title", () => {
  assert.equal(planTitle("### Sklep w Live i watch\n\n- Step"), "Sklep w Live i watch");
  assert.equal(planTitle("# Checkout ##\n\nText"), "Checkout");
  assert.equal(planTitle("No heading"), "Implementation plan");
});

test("Hides only an exact implementation prompt for an approved plan", () => {
  const plan = { text: markdown, decision: "approved" };
  const message = `${PLAN_PROMPT_PREFIX}\n\nApproved plan:\n\n${markdown.trim()}\n\nCarry out the work, make the necessary code changes, and verify the result.`;
  assert.equal(isPlanImplementation(message, plan), true);
  assert.equal(isPlanImplementation(message.replaceAll("\n", "\r\n"), plan), true);
  assert.equal(isPlanImplementation(message + "\nAdditional user instruction", plan), false);
  assert.equal(isPlanImplementation(message, { ...plan, text: "Different plan" }), false);
  assert.equal(isPlanImplementation(message, { ...plan, decision: "rejected" }), false);
  assert.equal(isPlanImplementation("Please implement this plan", plan), false);
});

test("Preserves plan Markdown from history without inventing an approval", () => {
  assert.deepEqual(parsePlan("plan", detail, undefined, "completed"), { text: markdown, decision: "proposed" });
  assert.equal(parsePlan("plan_approval", detail, undefined, "completed").decision, "proposed");
});

test("Uses the actual plan approval outcome and pending/canceled states", () => {
  assert.equal(parsePlan("plan_approval", detail, { approved: true }, "completed").decision, "approved");
  assert.equal(parsePlan("plan_approval", detail, { approved: false }, "completed").decision, "rejected");
  assert.equal(parsePlan("plan_approval", detail, {}, "running").decision, "pending");
  assert.equal(parsePlan("plan_approval", detail, {}, "canceled").decision, "canceled");
  assert.equal(parsePlan("plan_approval", detail, { approved: "false" }, "completed").decision, "proposed");
});

test("Rejects empty plans and unrelated tool details", () => {
  assert.equal(parsePlan("read", detail, undefined, "completed"), undefined);
  assert.equal(parsePlan("plan", { type: "plain_text", text: markdown }, undefined, "completed"), undefined);
  assert.equal(parsePlan("plan", { type: "plan", text: "  " }, undefined, "completed"), undefined);
  assert.equal(parsePlan("plan", { type: "plan", text: 42 }, undefined, "completed"), undefined);
});

function loadHistory(refetch) {
  const js = ts.transpileModule(fs.readFileSync(require.resolve("../client/plan-history.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "require", "module", js)(module.exports, name => {
    if (name === "./plan") return loaded.exports;
    if (name === "react") return { useEffect: effect => effect(), useSyncExternalStore: () => {} };
    if (name === "@getpaseo/plugin/client") return { usePaseo: () => ({
      agents: { ref: agentId => ({ timeline: { refetch: () => refetch(agentId) } }) },
    }) };
    return require(name);
  }, module);
  return module.exports;
}

test("Technical prompts are removed without an ask card and never cross conversations", () => {
  const history = loadHistory(async () => ({ entries: [] }));
  const plan = { text: markdown, decision: "approved" };
  const message = `${PLAN_PROMPT_PREFIX}\n\nApproved plan:\n\n${markdown.trim()}\n\nCarry out the work, make the necessary code changes, and verify the result.`;
  history.rememberPlan("agent-a", "plan-a", plan);
  assert.equal(history.useHiddenPlanMessage("agent-a", "message-a", message, false), true);
  assert.equal(history.isHiddenPlanMessage("message-a", message), true);
  assert.equal(history.useHiddenPlanMessage("agent-b", "message-b", message, false), false);
  assert.equal(history.useHiddenPlanMessage("agent-a", "image-message", message, true), false);
  assert.equal(history.isHiddenPlanMessage("image-message", message), false);
  assert.equal(history.isHiddenPlanMessage("message-a", message + "\nExtra"), false);
});

test("A collapsed plan is verified from raw history before hiding its technical prompt", async () => {
  const history = loadHistory(async () => ({ entries: [{ item: {
    type: "tool_call", callId: "plan-a", name: "plan_approval", detail,
    metadata: { approved: true }, status: "completed",
  } }] }));
  const message = `${PLAN_PROMPT_PREFIX}\n\nApproved plan:\n\n${markdown.trim()}\n\nCarry out the work, make the necessary code changes, and verify the result.`;
  assert.equal(history.useHiddenPlanMessage("agent-a", "message-a", message, false), false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(history.useHiddenPlanMessage("agent-a", "message-a", message, false), true);
  assert.equal(history.isHiddenPlanMessage("message-a", message), true);
});
