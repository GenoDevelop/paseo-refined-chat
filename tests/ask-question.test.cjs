const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

// This parser has only type imports; exercise the actual source without a UI runtime.
const source = fs.readFileSync(require.resolve("../client/ask-question.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = { exports: {} };
new Function("exports", "require", "module", compiled)(loaded.exports, require, loaded);
const { isAskTool, parseAskQuestions, applyAnswers, askTranscript, pairAskTranscripts, isAskReply, answerCodexQuestions, parseCodexQuestionMetadata } = loaded.exports;

test("Synchronous Codex reads options and descriptions from metadata and matches answers by ID", () => {
  const metadata = {
    questions: [
      { id: "context", header: "Context", question: "Which context?", options: [
        { label: "Use context (Recommended)", description: "Keep the source collection." },
        { label: "Hide", description: "Hide the strip." },
      ] },
      { id: "breadcrumbs", header: "Breadcrumbs", question: "Which path?", options: [
        { label: "Category, collection", description: "A label containing a comma." },
        { label: "Main category" },
      ] },
    ],
    // Insertion order differs from the questions; unrelated keys are ignored.
    answers: { unrelated: ["Ignored"], breadcrumbs: ["Category, collection"], context: ["Hide"] },
  };
  const parsed = parseCodexQuestionMetadata(metadata);
  assert.deepEqual(parsed.map(q => q.answers), [["Hide"], ["Category, collection"]]);
  assert.deepEqual(parsed.map(q => q.header), ["Context", "Breadcrumbs"]);
  assert.equal(parsed[0].options[0].description, "Keep the source collection.");
  assert.equal(parsed[0].options.length, 2);
  assert.equal(parsed[1].options[0].label, "Category, collection");
});

test("Synchronous Codex retains unanswered questions and typed or multiple recorded answers", () => {
  const questions = [
    { id: "a", question: "First?", options: [{ label: "A" }, { label: "B" }], multiSelect: true },
    { id: "b", question: "Second?" },
    { id: "c", question: "Third?" },
  ];
  assert.deepEqual(parseCodexQuestionMetadata({ questions }).map(q => q.answers), [[], [], []]);
  const parsed = parseCodexQuestionMetadata({ questions, answers: { a: ["A", "B"], b: ["Typed\nreply"], c: null } });
  assert.equal(parsed[0].multiple, true);
  assert.deepEqual(parsed.map(q => q.answers), [["A", "B"], ["Typed\nreply"], []]);
  assert.deepEqual(parseCodexQuestionMetadata({ questions: [null, {}, ...questions], answers: { a: [null, "", "A"] } })
    .map(q => q.answers), [["A"], [], []]);
  assert.deepEqual(parseCodexQuestionMetadata(null), []);
  assert.deepEqual(parseCodexQuestionMetadata({ questions: "invalid" }), []);
});

test("Captured Codex options survive answers, including commas and multiline free text", () => {
  const questions = parseAskQuestions({ questions: [
    { question: "Colour?", options: [{ label: "Green, blue" }, { label: "Purple" }] },
    { question: "Reply?", options: [] },
  ] });
  const initial = "Colour?\nGreen, blue, Purple\n\nReply?";
  assert.deepEqual(answerCodexQuestions(questions, initial), questions);
  const result = answerCodexQuestions(questions, "Colour?\nGreen, blue\n\nReply?\nFirst line\n\nSecond paragraph");
  assert.deepEqual(result.map(q => q.answers), [["Green, blue"], ["First line\n\nSecond paragraph"]]);
  assert.deepEqual(result[0].options, questions[0].options);
  assert.deepEqual(questions.map(q => q.answers), [[], []]);
  assert.deepEqual(answerCodexQuestions(questions, "Different?\nAnswer"), []);
  assert.deepEqual(answerCodexQuestions(questions, "Colour?\nPurple\n\nReply?"), []);
});

test("Only an exact complete answer envelope duplicates the card", () => {
  const transcript = "Colour?\nGreen\n\nReply?\nHello, world";
  assert.equal(isAskReply(`Answers to your questions:\n\n${transcript}`, transcript), true);
  assert.equal(isAskReply(`Answers to your questions:\r\n\r\n${transcript.replaceAll("\n", "\r\n")}`, transcript), true);
  assert.equal(isAskReply(transcript, transcript), false);
  assert.equal(isAskReply(`Answers to your questions:\n\n${transcript}\nExtra user text`, transcript), false);
  assert.equal(isAskReply("Answers to your questions:\n\nColour?\nPurple", transcript), false);
  assert.equal(isAskReply("Answers to your questions:\n\nColour?\nGreen", transcript), false);
  assert.equal(isAskReply("Answers to your questions:\n\n", ""), false);
});

test("Codex matching snapshots become question cards without splitting comma-containing replies", () => {
  const before = "Colour?\nGreen, Purple\n\nReply?";
  const after = "Colour?\nGreen\n\nReply?\nHello, world\nSecond line";
  const result = pairAskTranscripts(before, after);
  assert.deepEqual(result.map(q => q.answers), [["Green"], ["Hello, world\nSecond line"]]);
  assert.deepEqual(result.map(q => q.options), [[], []]);
  assert.deepEqual(pairAskTranscripts(before, before), []);
  assert.deepEqual(pairAskTranscripts(before, "Different?\nAnswer"), []);
  assert.deepEqual(pairAskTranscripts(before, after + "\n\nExtra paragraph"), []);
});

test("Codex projected transcript displays questions and answers without guessing option boundaries", () => {
  const transcript = "Colour?\nOrange\n\nYour reply?\nTyped answer";
  assert.equal(askTranscript({ type: "plain_text", text: transcript }, undefined), transcript);
  assert.equal(askTranscript({ type: "plain_text", text: transcript }, "Existing output"), "Existing output");
  assert.equal(askTranscript({ type: "other", text: transcript }, undefined), undefined);
});

test("Codex async questions accept titles, string options and free text", () => {
  assert.equal(isAskTool("request_user_input_async"), true);
  assert.equal(isAskTool("request_user_input"), true);
  assert.equal(isAskTool("unrelated_request_user_input"), false);
  const questions = parseAskQuestions({ questions: [
    { title: "Colour?", options: ["Green", "Purple"] },
    { title: "Your reply?" },
  ] });
  assert.deepEqual(questions.map(q => q.question), ["Colour?", "Your reply?"]);
  assert.deepEqual(questions[0].options.map(o => o.label), ["Green", "Purple"]);
  assert.deepEqual(applyAnswers(questions, [{ accepted: true }], undefined).map(q => q.answers), [[], []]);
});

test("OpenCode preserves per-question multi-select and typed answers", () => {
  assert.equal(isAskTool("question"), true);
  const questions = parseAskQuestions({ questions: [
    { question: "Picks?", multiple: true, options: [{ label: "A" }, { label: "B" }] },
    { question: "Reply?" },
  ] });
  assert.equal(questions[0].multiple, true);
  assert.deepEqual(applyAnswers(questions, [{ metadata: { answers: [["A", "B"], ["Typed"]] } }], undefined)
    .map(q => q.answers), [["A", "B"], ["Typed"]]);
});

test("Claude keeps question precedence and splits selected labels from result prose", () => {
  assert.equal(isAskTool("AskUserQuestion"), true);
  const questions = parseAskQuestions({ questions: [
    { question: "Picks?", title: "Ignored", multiSelect: true, options: [{ label: "A" }, { label: "B" }] },
    { question: "Reply?" },
  ] });
  assert.equal(questions[0].question, "Picks?");
  assert.equal(questions[0].multiple, true);
  assert.deepEqual(applyAnswers(questions, [], 'User has answered your questions: "Picks?"="A, B", "Reply?"="Typed".')
    .map(q => q.answers), [["A", "B"], ["Typed"]]);
});

test("Oh My Pi single-question selectedOptions still contains all picks", () => {
  const questions = parseAskQuestions({ question: "Picks?", options: ["A", "B"] });
  assert.deepEqual(applyAnswers(questions, [{ details: { selectedOptions: ["A", "B"] } }], undefined)[0].answers, ["A", "B"]);
});
