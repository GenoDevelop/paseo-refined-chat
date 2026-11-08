import type { AskQuestionData } from "../shared/contracts";

/**
 * Agents ask the user a question through differently named tools: `ask`
 * (Oh My Pi), `question` (opencode), `AskUserQuestion` (Claude Code) and
 * `request_user_input` (Codex). They share one shape — a list of questions,
 * each with options — so a single card draws all of them.
 */
const ASK_TOOLS = new Set(["ask", "question", "askuserquestion", "requestuserinput", "requestuserinputasync"]);

export function isAskTool(name: string): boolean {
  return ASK_TOOLS.has(name.toLowerCase().replace(/[^a-z]/g, ""));
}

/** Codex's projected question card carries its readable transcript, not arguments. */
export function askTranscript(detail: Record<string, unknown>, output: string | undefined): string | undefined {
  return output || (detail.type === "plain_text" && typeof detail.text === "string" ? detail.text : undefined);
}

/** Only the host's complete answer envelope can duplicate a question card. */
export function isAskReply(message: string, transcript: string): boolean {
  const normalized = message.replace(/\r\n/g, "\n").trim();
  const prefix = "Answers to your questions:\n\n";
  const body = transcript.replace(/\r\n/g, "\n").trim();
  return body !== "" && normalized.startsWith(prefix) && normalized.slice(prefix.length) === body;
}

/** Use known question boundaries, preserving options and multiline typed replies. */
export function answerCodexQuestions(questions: AskQuestionData[], transcript: string): AskQuestionData[] {
  const text = transcript.replace(/\r\n/g, "\n").trim();
  const initial = questions.map(q => [q.question, q.options.map(o => o.label).join(", ")]
    .filter(Boolean).join("\n")).join("\n\n");
  if (text === initial) return questions;
  let rest = text;
  const result: AskQuestionData[] = [];
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index]!;
    const prefix = `${question.question}\n`;
    if (!rest.startsWith(prefix)) return [];
    rest = rest.slice(prefix.length);
    const next = questions[index + 1];
    const boundary = next ? `\n\n${next.question}\n` : undefined;
    const end = boundary ? rest.indexOf(boundary) : rest.length;
    if (end < 0 || (boundary && rest.indexOf(boundary, end + 1) !== -1)) return [];
    const answer = rest.slice(0, end);
    if (!answer.trim()) return [];
    result.push({ ...question, answers: [answer] });
    if (next) rest = rest.slice(end + 2);
  }
  return result;
}

/** Pair only matching paragraph headings; never infer options by splitting commas. */
export function pairAskTranscripts(before: string, after: string): AskQuestionData[] {
  if (before === after) return [];
  const initial = before.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  const answered = after.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  if (initial.length !== answered.length) return [];
  const questions: AskQuestionData[] = [];
  for (let index = 0; index < initial.length; index++) {
    const question = initial[index]!.split("\n")[0]!;
    const [heading, ...reply] = answered[index]!.split("\n");
    if (!question || heading !== question || !reply.join("\n").trim()) return [];
    questions.push({ question, multiple: false, options: [], answers: [reply.join("\n")] });
  }
  return questions;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseOptions(raw: unknown, recommended: number | undefined): AskQuestionData["options"] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry, index) => {
    // A bare string is a label with nothing else to say.
    const option = typeof entry === "string" ? { label: entry } : object(entry);
    const label = text(option?.label);
    if (!option || !label) return [];
    return [
      {
        id: text(option.id) || `opt-${index}`,
        label,
        description: text(option.description) || undefined,
        recommended: index === recommended,
      },
    ];
  });
}

/**
 * Every question the call asks. The tools nest them under `questions`, and a
 * single call can carry several: reading only the first left the rest, and
 * their answers, out of the card.
 */
export function parseAskQuestions(input: Record<string, unknown>): AskQuestionData[] {
  const entries = Array.isArray(input.questions)
    ? input.questions
    : typeof input.question === "string"
      ? [input]
      : [];

  return entries.flatMap((entry): AskQuestionData[] => {
    const raw = object(entry);
    if (!raw) return [];
    const question = text(raw.question) || text(raw.title);
    const options = parseOptions(
      raw.options,
      typeof raw.recommended === "number" ? raw.recommended : undefined,
    );
    if (!question && options.length === 0) return [];
    return [
      {
        question,
        header: text(raw.header) || undefined,
        multiple: raw.multiple === true || raw.multiSelect === true,
        options,
        answers: [],
      },
    ];
  });
}

const unescape = (value: string) => value.replace(/\\(["\\])/g, "$1");
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The result text reads `User has answered your questions: "Q"="A", "Q"="A".
 * You can now continue…` in both opencode and Claude Code.
 */
export function parseAnswerPairs(prose: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const match of prose.matchAll(/"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"/g)) {
    pairs.push([unescape(match[1]!), unescape(match[2]!)]);
  }
  return pairs;
}

/**
 * One answer string may hold several picked labels joined by a comma. The
 * labels are matched longest first, so a label that contains a comma stays one
 * pick, and text that matches no label — a typed reply — stays whole.
 */
function splitAnswer(question: AskQuestionData, value: string): string[] {
  const labels = question.options.map((option) => option.label).sort((a, b) => b.length - a.length);
  const picks: string[] = [];
  let rest = value.trim();
  while (rest) {
    const hit = labels.find(
      (label) =>
        rest.toLowerCase().startsWith(label.toLowerCase()) &&
        (rest.length === label.length || /^,\s*/.test(rest.slice(label.length))),
    );
    if (!hit) {
      picks.push(rest);
      break;
    }
    picks.push(hit);
    rest = rest.slice(hit.length).replace(/^,\s*/, "");
  }
  return picks.length > 0 ? picks : [value];
}

/**
 * Answers the host reports as data, per question: `metadata.answers` is a list
 * of lists, `details.selectedOptions` a flat list for a single question.
 */
function reported(containers: unknown[], count: number): string[][] | undefined {
  for (const container of containers) {
    const root = object(container);
    if (!root) continue;
    const metadata = object(root.metadata);
    const details = object(root.details);
    for (const candidate of [root.answers, metadata?.answers, details?.selectedOptions, metadata?.selectedOptions]) {
      if (!Array.isArray(candidate) || candidate.length === 0) continue;
      const nested = candidate.every((entry) => Array.isArray(entry) || typeof entry === "string");
      if (!nested) continue;
      // A flat list of strings answers one question, as the list of its picks.
      if (count === 1 && candidate.every((entry) => typeof entry === "string")) {
        return [candidate as string[]];
      }
      return candidate.map((entry) =>
        (Array.isArray(entry) ? entry : [entry]).filter(
          (answer): answer is string => typeof answer === "string" && answer.length > 0,
        ),
      );
    }
  }
  return undefined;
}

/**
 * Attaches each question's answer. The order of trust is the data the host
 * reports, then the `"question"="answer"` text, then — for a single question —
 * a bare reply such as `User selected: X`.
 */
export function applyAnswers(
  questions: AskQuestionData[],
  containers: unknown[],
  prose: string | undefined,
): AskQuestionData[] {
  if (questions.length === 0) return questions;

  const data = reported(containers, questions.length);
  if (data?.some((answers) => answers.length > 0)) {
    return questions.map((question, index) => ({ ...question, answers: data[index] ?? [] }));
  }

  const pairs = prose ? parseAnswerPairs(prose) : [];
  if (pairs.length > 0) {
    const aligned = pairs.length === questions.length;
    return questions.map((question, index) => {
      const found =
        pairs.find(([asked]) => question.question && same(asked, question.question)) ??
        (aligned ? pairs[index] : undefined);
      return { ...question, answers: found ? splitAnswer(question, found[1]) : [] };
    });
  }

  if (questions.length === 1 && prose) {
    const trimmed = prose.trim();
    // The sentence the tool wraps around the pairs is not an answer.
    if (trimmed && !/^user has answered your questions/i.test(trimmed)) {
      const reply = trimmed.replace(/^user\s+(?:selected|answered|chose)\s*:?\s*/i, "").trim();
      if (reply) return [{ ...questions[0]!, answers: [reply] }];
    }
  }
  return questions;
}

export { same as sameAnswer };
