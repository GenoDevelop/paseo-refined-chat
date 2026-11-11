const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function("exports", "require", "module", code)(module.exports, name => name.startsWith(".")
    ? load(path.resolve(path.dirname(file), name + ".ts")) : require(name), module);
  return module.exports;
}
const { outlineEntries } = load(path.resolve(__dirname, "../client/conversation-outline.ts"));
const row = (seq, item) => ({ seqStart: seq, seqEnd: seq, timestamp: "2026-11-11T12:00:00Z", item });
const tool = (callId, name, detail, status = "completed", metadata) => ({ type: "tool_call", callId, name, detail, status, metadata });

test("Indexes the requested kinds without filling the outline with reads and shell output", () => {
  const entries = outlineEntries([
    row(1, { type: "user_message", messageId: "prompt", text: "Please build it\nDetails" }),
    row(2, tool("plan", "plan", { type: "plan", text: "# Checkout\n\nSteps" })),
    row(3, tool("question", "request_user_input", {}, "completed", { questions: [{ id: "colour", question: "Colour?", options: [{ label: "Purple" }] }], answers: { colour: ["Purple"] } })),
    row(4, tool("write", "write", { type: "write", filePath: "src/app.ts", content: "new content" })),
    row(5, { ...tool("failed", "shell", {}, "failed"), error: "Tests failed" }),
    row(6, tool("read", "read", { type: "read", content: "lots of code" })),
    row(7, tool("shell", "shell", { output: "success" })),
  ]);
  assert.deepEqual(entries.map(entry => entry.kind), ["Prompt", "Plan", "Question", "Error"]);
  assert.equal(entries[1].title, "Checkout");
  assert.equal(entries[1].body, "# Checkout\n\nSteps");
  assert.match(entries[2].body, /Answer:\*\* Purple/);
  assert.equal(entries[3].title, "shell: Tests failed");
  assert.equal(entries[0].messageId, "prompt");
});

test("Merges request and answer lifecycle records at their first history position", () => {
  const entries = outlineEntries([
    row(4, tool("ask", "request_user_input_async", { type: "plain_text", text: "Colour?\nPurple" })),
    row(2, { type: "user_message", text: "A later prompt" }),
    row(1, tool("ask", "request_user_input_async", { type: "plain_text", text: "Colour?\nGreen, Purple" })),
  ]);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].id, "entry:1");
  assert.equal(entries[0].body, "Colour?\nPurple");
});

test("Skips only exact technical duplicates with matching plan or question records", () => {
  const body = "# Plan\n\nDo work";
  const technical = "The user approved the plan. Implement it now. Do not restate or revise the plan unless blocked.\n\nApproved plan:\n\n" + body + "\n\nCarry out the work, make the necessary code changes, and verify the result.";
  const entries = outlineEntries([
    row(1, tool("plan", "plan_approval", { type: "plan", text: body }, "completed", { approved: true })),
    row(2, { type: "user_message", text: technical }),
    row(3, tool("ask", "request_user_input_async", { text: "Colour?\nPurple" })),
    row(4, { type: "user_message", text: "Answers to your questions:\n\nColour?\nPurple" }),
    row(5, { type: "user_message", text: technical + "\nMy extra instruction" }),
  ]);
  assert.deepEqual(entries.map(entry => entry.kind), ["Plan", "Question", "Prompt"]);
});

test("Successful file edits are omitted while Claude answers and failed edits remain visible", () => {
  const entries = outlineEntries([
    row(1, tool("edit", "edit", { filePath: "app.ts", oldString: "before", newString: "after" })),
    row(2, tool("ask", "AskUserQuestion", { input: { questions: [{ question: "Pick?", options: [{ label: "A" }] }] }, output: 'User has answered your questions: "Pick?"="A".' })),
    row(3, { ...tool("failed-edit", "edit", {}, "failed"), error: "Edit failed" }),
    row(4, tool("patch", "apply_patch", { text: "Patch applied" })),
  ]);
  assert.deepEqual(entries.map(entry => entry.kind), ["Question", "Error"]);
  assert.match(entries[0].body, /Answer:\*\* A/);
});
