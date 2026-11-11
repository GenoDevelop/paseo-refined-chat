const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(file) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function("exports", "require", "module", code)(loaded.exports,
    name => name.startsWith(".") ? load(path.resolve(path.dirname(file), name + ".ts")) : require(name), loaded);
  return loaded.exports;
}
const { planExportFilename, downloadPlanMarkdown } = load(path.resolve(__dirname, "../client/plan-export.ts"));

test("Export names preserve Polish text but cannot become paths or reserved Windows filenames", () => {
  assert.equal(planExportFilename("# Zażółć gęślą jaźń\nText"), "plan-zażółć-gęślą-jaźń.md");
  assert.equal(planExportFilename('# CON: ../bad\\name?*<>|"'), "plan-con-..-bad-name.md");
  assert.equal(planExportFilename("# ..."), "plan-untitled.md");
  assert.ok(planExportFilename("# " + "A".repeat(500)).length <= 104);
  assert.equal(planExportFilename("No heading"), "plan-implementation-plan.md");
});

function browser(click) {
  const original = { document: global.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL, timeout: global.setTimeout };
  const revoked = []; const timers = []; let blob; let attached = false; let removed = false;
  const link = { click: () => click(link), remove: () => { removed = true; } };
  global.document = { createElement: () => link, body: { appendChild: () => { attached = true; } } };
  URL.createObjectURL = value => { blob = value; return "blob:plan"; };
  URL.revokeObjectURL = value => revoked.push(value);
  global.setTimeout = fn => { timers.push(fn); return 1; };
  return { link, revoked, timers, get blob() { return blob; }, get attached() { return attached; }, get removed() { return removed; },
    cleanup() { global.document = original.document; URL.createObjectURL = original.create; URL.revokeObjectURL = original.revoke; global.setTimeout = original.timeout; } };
}

test("Downloads exactly the original UTF-8 Markdown and releases its URL after starting", async () => {
  const markdown = "# Plan\r\n\r\n- Zażółć\r\n\r\n```ts\r\nconst x = 1;\r\n```\r\n";
  let clicked = false;
  const env = browser(link => { clicked = true; assert.equal(link.href, "blob:plan"); });
  try {
    downloadPlanMarkdown(markdown);
    assert.equal(clicked, true); assert.equal(env.attached, true); assert.equal(env.removed, true);
    assert.equal(env.link.download, "plan-plan.md");
    assert.equal(await env.blob.text(), markdown);
    assert.equal(env.blob.type, "text/markdown;charset=utf-8");
    assert.deepEqual(env.revoked, []);
    env.timers.forEach(fn => fn());
    assert.deepEqual(env.revoked, ["blob:plan"]);
  } finally { env.cleanup(); }
});

test("Failed downloads still remove the link and revoke the object URL", () => {
  const env = browser(() => { throw new Error("Download denied"); });
  try {
    assert.throws(() => downloadPlanMarkdown("# Plan"), /Download denied/);
    assert.equal(env.removed, true);
    assert.deepEqual(env.revoked, ["blob:plan"]);
  } finally { env.cleanup(); }
});
