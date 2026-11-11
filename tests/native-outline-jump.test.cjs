const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const code = ts.transpileModule(fs.readFileSync(require.resolve("../client/native-outline-jump.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = { exports: {} };
new Function("exports", "require", "module", code)(loaded.exports, require, loaded);
const { nativeChatBindings, nativeMessageId, nativeOutlineJump, mountedOutlineRow, settleOutlineJump } = loaded.exports;
const entry = { id: "entry:10", seq: 10, kind: "Question", callId: "call-a" };

function environment() {
  const oldDocument = global.document;
  const oldRuntime = global.__paseoHostRuntimeStore;
  const events = new Map();
  let visible = false;
  let scrolled = "";
  const row = { absoluteTop: 1000, height: 300, getClientRects: () => [1], querySelector: () => null,
    getBoundingClientRect: () => ({ top: row.absoluteTop - chat.scrollTop, height: row.height }) };
  const props = {
    agentId: "agent-a", serverId: "host-a", items: [],
    viewportRef: { current: { scrollToMessage(id) { scrolled = id; visible = true; } } },
  };
  const chat = { __reactFiber$test: { return: { memoizedProps: props } },
    scrollTop: 0, scrollHeight: 3000, clientHeight: 600, getBoundingClientRect: () => ({ top: 0, bottom: 600 }),
    getClientRects: () => [1], contains: value => value === row,
    addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name),
  };
  global.document = { querySelectorAll: () => [chat], getElementById: () => visible ? row : null };
  return { props, chat, row, events, get scrolled() { return scrolled; },
    cleanup() { global.document = oldDocument; global.__paseoHostRuntimeStore = oldRuntime; } };
}

test("Private bindings must belong to the exact host and agent", () => {
  const env = environment();
  try {
    assert.equal(nativeChatBindings(env.chat, "agent-a", "host-a"), env.props);
    assert.equal(nativeChatBindings(env.chat, "agent-b", "host-a"), null);
    assert.equal(nativeChatBindings(env.chat, "agent-a", "host-b"), null);
    assert.equal(nativeChatBindings({}, "agent-a", "host-a"), null);
  } finally { env.cleanup(); }
});

test("Projected tool identities and native cursor identities resolve without guessed row IDs", () => {
  assert.equal(nativeMessageId([{ id: "plugin/row", kind: "plugin", data: { callId: "call-a" } }], entry, "epoch-a"), "plugin/row");
  assert.equal(nativeMessageId([{ id: "native-row", timelineCursor: { epoch: "epoch-a", seq: 10 } }], entry, "epoch-a"), "native-row");
  assert.equal(nativeMessageId([{ id: "wrong-epoch", timelineCursor: { epoch: "epoch-b", seq: 10 } }], entry, "epoch-a"), null);
});

test("Uses updated React alternate props when the original fiber still has old items", () => {
  const env = environment();
  try {
    const updated = { ...env.props, items: [{ id: "target", kind: "plugin", data: { callId: "call-a" } }] };
    env.chat.__reactFiber$test.return.alternate = { memoizedProps: updated };
    assert.equal(nativeChatBindings(env.chat, "agent-a", "host-a", entry, "epoch-a"), updated);
  } finally { env.cleanup(); }
});

test("Loads a native history window and reveals its previously unmounted target", async () => {
  const env = environment(); let revealed = false;
  global.__paseoHostRuntimeStore = { async fetchAgentTimeline(host, agent, options) {
    assert.equal(host, "host-a"); assert.equal(agent, "agent-a");
    assert.deepEqual(options.cursor, { epoch: "epoch-a", seq: 31 });
    assert.equal(options.mergeWindow, true);
    env.props.items = [{ id: "plugin/target", kind: "plugin", data: { callId: "call-a" } }];
    return { epoch: "epoch-a" };
  } };
  try {
    assert.equal(await nativeOutlineJump("host-a", "agent-a", "epoch-a", entry, new AbortController().signal, () => { revealed = true; }), null);
    assert.equal(revealed, true);
    assert.equal(env.scrolled, "plugin/target");
    assert.equal(env.row.getBoundingClientRect().top, 16);
    assert.equal(env.events.size, 0);
  } finally { env.cleanup(); }
});

test("Unsupported runtime and stale history fail closed without revealing groups", async () => {
  const env = environment(); let revealed = false;
  try {
    global.__paseoHostRuntimeStore = {};
    assert.match(await nativeOutlineJump("host-a", "agent-a", "epoch-a", entry, new AbortController().signal, () => {}), /unavailable/);
    global.__paseoHostRuntimeStore = { fetchAgentTimeline: async () => ({ epoch: "changed", staleCursor: true }) };
    assert.match(await nativeOutlineJump("host-a", "agent-a", "epoch-a", entry, new AbortController().signal, () => { revealed = true; }), /History changed/);
    assert.equal(revealed, false);
  } finally { env.cleanup(); }
});

test("Cancel interrupts a pending native fetch without waiting for its response", async () => {
  const env = environment(); const controller = new AbortController(); let revealed = false;
  global.__paseoHostRuntimeStore = { fetchAgentTimeline: () => new Promise(() => {}) };
  try {
    const result = nativeOutlineJump("host-a", "agent-a", "epoch-a", entry, controller.signal, () => { revealed = true; });
    controller.abort();
    assert.equal(await result, "Jump canceled.");
    assert.equal(revealed, false);
    assert.equal(env.events.size, 0);
  } finally { env.cleanup(); }
});

test("Finding a mounted but collapsed card is not considered a successful jump", () => {
  const env = environment();
  try {
    env.props.viewportRef.current.scrollToMessage("target");
    env.row.querySelector = () => ({});
    assert.equal(mountedOutlineRow(env.chat, "agent-a", entry), null);
    env.row.querySelector = () => null;
    assert.equal(mountedOutlineRow(env.chat, "agent-a", entry), env.row);
  } finally { env.cleanup(); }
});

test("A correction, remount or size change restarts the layout quiet period", () => {
  const layout = { row: {}, top: 16, height: 300, viewportHeight: 600, scrollTop: 984 };
  let state = settleOutlineJump(null, layout, 0, false);
  assert.equal(settleOutlineJump(state, layout, 599, false).done, false);
  assert.equal(settleOutlineJump(state, layout, 600, false).done, true);
  state = settleOutlineJump(state, { ...layout, height: 500 }, 650, false);
  assert.equal(state.since, 650);
  state = settleOutlineJump(state, state.layout, 800, true);
  assert.equal(state.since, 800);
  state = settleOutlineJump(state, { ...state.layout, row: {} }, 900, false);
  assert.equal(state.since, 900);
  assert.equal(settleOutlineJump(state, state.layout, 1500, false).done, true);
});

test("A layout shift during navigation is corrected before the jump completes", async () => {
  const env = environment();
  global.__paseoHostRuntimeStore = { async fetchAgentTimeline() {
    env.props.items = [{ id: "target", kind: "plugin", data: { callId: "call-a" } }];
    return { epoch: "epoch-a" };
  } };
  const shift = setTimeout(() => { env.row.absoluteTop += 200; env.row.height += 100; }, 200);
  try {
    assert.equal(await nativeOutlineJump("host-a", "agent-a", "epoch-a", entry, new AbortController().signal, () => {}), null);
    assert.equal(env.chat.scrollTop, 1184);
    assert.equal(env.row.getBoundingClientRect().top, 16);
  } finally { clearTimeout(shift); env.cleanup(); }
});

test("Already loaded destinations also settle and do not refetch history", async () => {
  const env = environment();
  env.props.viewportRef.current.scrollToMessage("already loaded");
  global.__paseoHostRuntimeStore = { fetchAgentTimeline() { throw new Error("Unnecessary fetch"); } };
  try {
    assert.equal(await nativeOutlineJump("host-a", "agent-a", "epoch-a", entry, new AbortController().signal, () => {}), null);
    assert.equal(env.row.getBoundingClientRect().top, 16);
  } finally { env.cleanup(); }
});
