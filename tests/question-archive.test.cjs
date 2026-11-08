const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loadClient() {
  const cache = new Map();
  const cleanups = [];
  const mocks = {
    react: {
      useEffect: effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); },
      useSyncExternalStore: () => {},
    },
    "@getpaseo/plugin/client": { usePaseo: () => ({ agents: { ref: () => ({
      subscribe: () => () => {}, refresh: async () => null,
    }) } }) },
    "@getpaseo/plugin": { defineSettings: value => value, settingsRpc: () => ({ read: "read", write: "write" }) },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    new Function("exports", "require", "module", js)(module.exports, name => {
      if (mocks[name]) return mocks[name];
      return name.startsWith(".") ? load(path.resolve(path.dirname(file), name + ".ts")) : require(name);
    }, module);
    return module.exports;
  }
  return { ...load(path.resolve(__dirname, "../client/codex-ask.ts")),
    cleanup: () => cleanups.reverse().forEach(cleanup => cleanup()) };
}

const request = call => ({
  id: `permission-${call}`, provider: "codex", name: "request_user_input_async",
  input: { questions: [{ question: "Colour?", options: [{ label: "Green, blue" }, { label: "Purple" }] }] },
});

test("Question definitions survive a fresh client; answers stay in timeline", async () => {
  let values = { calls: {} };
  let revision = 0;
  const rpc = async (contract, input) => {
    if (contract === "read") return { status: "ready", revision: String(revision), values };
    assert.equal(input.revision, String(revision));
    values = JSON.parse(JSON.stringify(input.values));
    return { status: "saved", revision: String(++revision), values };
  };
  const first = loadClient();
  const stop = first.attachQuestionArchive(rpc);
  first.captureCodexQuestions("agent-a", [request("call-a")]);
  await first.refreshQuestionArchive();
  assert.deepEqual(values.calls["agent-a:call-a"][0].answers, []);
  assert.equal(values.calls["agent-a:call-a"][0].options[0].label, "Green, blue");
  stop();
  const second = loadClient();
  const stopSecond = second.attachQuestionArchive(rpc);
  await second.refreshQuestionArchive();
  const card = second.useCodexAsk("agent-a", "call-a", 1, "Colour?\nGreen, blue");
  assert.deepEqual(card.questions[0].answers, ["Green, blue"]);
  assert.equal(card.questions[0].options.length, 2);
  assert.equal(second.useCodexAsk("agent-b", "call-a", 1, "Colour?\nGreen, blue").questions.length, 0);
  second.cleanup();
  stopSecond();
});

test("Revision conflict merges another device's definitions instead of overwriting them", async () => {
  let values = { calls: {} };
  let revision = 0;
  let conflicted = false;
  const rpc = async (contract, input) => {
    if (contract === "read") return { status: "ready", revision: String(revision), values };
    if (!conflicted) {
      conflicted = true;
      values = { calls: { "other-agent:other-call": [{ question: "Other?", multiple: false, options: [], answers: [] }] } };
      revision++;
      return { status: "conflict" };
    }
    assert.equal(input.revision, String(revision));
    values = input.values;
    return { status: "saved", revision: String(++revision), values };
  };
  const client = loadClient();
  const stop = client.attachQuestionArchive(rpc);
  client.captureCodexQuestions("agent-a", [request("call-a")]);
  await client.refreshQuestionArchive();
  assert.equal(conflicted, true);
  assert.deepEqual(Object.keys(values.calls).sort(), ["agent-a:call-a", "other-agent:other-call"]);
  stop();
});

test("Collapsed groups hide exact answer duplicates without mounting any ask renderer", () => {
  const client = loadClient();
  const transcript = "Colour?\nPurple";
  const message = `Answers to your questions:\n\n${transcript}`;
  client.captureCodexQuestions("agent-a", [request("call-a")]);
  client.noteCodexAskProjection("call-a", "request_user_input_async", { type: "plain_text", text: transcript });
  // No useCodexAsk call: a collapsed run projects the item but never mounts it.
  assert.equal(client.useIsCodexAskReply("agent-a", message), true);
  client.noteCodexAskReply("agent-a", "message-a", message);
  assert.equal(client.isHiddenCodexReply("message-a", message), true);
  assert.equal(client.isHiddenCodexReply("message-a", message + "\nExtra text"), false);
  assert.equal(client.isHiddenCodexReply("other-message", message), false);
  assert.equal(client.useIsCodexAskReply("agent-b", message), false);
  client.noteCodexAskReply("agent-b", "message-b", message);
  assert.equal(client.isHiddenCodexReply("message-b", message), false);
});

test("Archive restoration hides a collapsed history reply without expanding the group", async () => {
  const client = loadClient();
  const message = "Answers to your questions:\n\nColour?\nPurple";
  client.noteCodexAskProjection("call-a", "request_user_input_async", { type: "plain_text", text: "Colour?\nPurple" });
  assert.equal(client.useIsCodexAskReply("agent-a", message), false);
  const stop = client.attachQuestionArchive(async () => ({
    status: "ready", revision: "1", values: { calls: { "agent-a:call-a": [{
      question: "Colour?", multiple: false, options: [{ id: "opt-0", label: "Purple" }], answers: [],
    }] } },
  }));
  await client.refreshQuestionArchive();
  assert.equal(client.useIsCodexAskReply("agent-a", message), true);
  client.noteCodexAskReply("agent-a", "message-a", message);
  assert.equal(client.isHiddenCodexReply("message-a", message), true);
  stop();
});

test("Unknown or non-Codex projections cannot hide user answers", () => {
  const client = loadClient();
  const message = "Answers to your questions:\n\nColour?\nPurple";
  client.captureCodexQuestions("agent-a", [request("call-a")]);
  client.noteCodexAskProjection("call-a", "AskUserQuestion", { type: "plain_text", text: "Colour?\nPurple" });
  assert.equal(client.useIsCodexAskReply("agent-a", message), false);
  client.noteCodexAskProjection("call-a", "request_user_input_async", { type: "plain_text", text: "Colour?\nGreen, blue, Purple" });
  assert.equal(client.useIsCodexAskReply("agent-a", message), false);
});
