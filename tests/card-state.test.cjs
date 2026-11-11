const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const code = ts.transpileModule(fs.readFileSync(require.resolve("../client/card-state.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = { exports: {} };
new Function("exports", "require", "module", code)(loaded.exports, require, loaded);
const { requestCardReveal, cancelCardReveal, subscribeCardReveal } = loaded.exports;

test("A jump immediately opens the mounted destination, without opening another agent's card", () => {
  let target = 0; let other = 0;
  const stop = subscribeCardReveal("agent-a:call", () => target++);
  const stopOther = subscribeCardReveal("agent-b:call", () => other++);
  requestCardReveal("agent-a:call");
  assert.equal(target, 1); assert.equal(other, 0);
  stop(); stopOther();
});

test("A jump into a collapsed group waits for the card to mount and is consumed once", () => {
  let revealed = 0;
  requestCardReveal("agent-a:hidden");
  const stop = subscribeCardReveal("agent-a:hidden", () => revealed++);
  assert.equal(revealed, 1);
  stop();
  const stopAgain = subscribeCardReveal("agent-a:hidden", () => revealed++);
  assert.equal(revealed, 1);
  stopAgain();
});

test("Canceling a pending jump does not open the card on an unrelated later mount", () => {
  let revealed = false;
  requestCardReveal("agent-a:canceled");
  cancelCardReveal("agent-a:canceled");
  const stop = subscribeCardReveal("agent-a:canceled", () => { revealed = true; });
  assert.equal(revealed, false);
  stop();
});
