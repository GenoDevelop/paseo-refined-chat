/**
 * Builds unified-diff text from an edit's old and new strings, for providers
 * that ship the before and after instead of a patch. The host's own tool view
 * makes the same computation, so a card shows the same change native does.
 *
 * The similarity table is bounded: an edit whose sides multiply past the cap
 * is emitted as one whole replacement rather than stalled over.
 */

const MAX_TABLE_CELLS = 400_000;
const CONTEXT = 3;

type Op = { type: "same" | "del" | "add"; text: string };

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.replace(/\r\n/g, "\n").split("\n");
}

function lcsOps(a: string[], b: string[]): Op[] {
  const cols = b.length + 1;
  const table = new Uint32Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        a[i]! === b[j]!
          ? (table[(i + 1) * cols + (j + 1)] ?? 0) + 1
          : Math.max(table[(i + 1) * cols + j] ?? 0, table[i * cols + (j + 1)] ?? 0);
    }
  }

  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i]! === b[j]!) {
      ops.push({ type: "same", text: a[i]! });
      i++;
      j++;
    } else if ((table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + (j + 1)] ?? 0)) {
      ops.push({ type: "del", text: a[i]! });
      i++;
    } else {
      ops.push({ type: "add", text: b[j]! });
      j++;
    }
  }
  while (i < a.length) {
    ops.push({ type: "del", text: a[i]! });
    i++;
  }
  while (j < b.length) {
    ops.push({ type: "add", text: b[j]! });
    j++;
  }
  return ops;
}

export function buildUnifiedDiffText(oldText: string, newText: string): string {
  if (oldText === newText) return "";
  const a = splitLines(oldText);
  const b = splitLines(newText);
  const ops: Op[] =
    a.length * b.length > MAX_TABLE_CELLS
      ? [
          ...a.map((text) => ({ type: "del" as const, text })),
          ...b.map((text) => ({ type: "add" as const, text })),
        ]
      : lcsOps(a, b);

  // hunks: runs of changes whose gap stays within twice the context merge
  // into one; each hunk grows its context on both edges.
  const changeIndexes = ops
    .map((op, index) => (op.type === "same" ? -1 : index))
    .filter((index) => index >= 0);
  if (changeIndexes.length === 0) return "";

  const groups: number[][] = [[changeIndexes[0]!]];
  for (let k = 1; k < changeIndexes.length; k++) {
    const group = groups[groups.length - 1]!;
    if (changeIndexes[k]! - group[group.length - 1]! <= CONTEXT * 2 + 1) {
      group.push(changeIndexes[k]!);
    } else {
      groups.push([changeIndexes[k]!]);
    }
  }

  // Line positions are global: aPos[k] is the 1-based old-file line op k sits
  // on, so a hunk's header can be read straight off its first op.
  const aPos: number[] = new Array(ops.length);
  const bPos: number[] = new Array(ops.length);
  let aLine = 1;
  let bLine = 1;
  for (let k = 0; k < ops.length; k++) {
    aPos[k] = aLine;
    bPos[k] = bLine;
    if (ops[k]!.type !== "add") aLine++;
    if (ops[k]!.type !== "del") bLine++;
  }

  const out: string[] = [];
  for (const group of groups) {
    const from = Math.max(0, group[0]! - CONTEXT);
    const to = Math.min(ops.length, group[group.length - 1]! + CONTEXT + 1);
    let aCount = 0;
    let bCount = 0;
    for (let k = from; k < to; k++) {
      if (ops[k]!.type !== "add") aCount++;
      if (ops[k]!.type !== "del") bCount++;
    }
    out.push(
      `@@ -${aPos[from]!},${aCount} +${bPos[from]!},${bCount} @@`,
    );
    for (let k = from; k < to; k++) {
      out.push(
        `${ops[k]!.type === "same" ? " " : ops[k]!.type === "del" ? "-" : "+"}${ops[k]!.text}`,
      );
    }
  }

  return out.join("\n");
}

/**
 * Added and removed line counts of a unified diff. Lines before the first hunk
 * header are file headers (`--- a/x`, `+++ b/x`), not changes, so they are
 * skipped; a diff with no hunk header at all is counted as it stands.
 */
export function countDiffLines(diff: string): { added: number; removed: number } {
  const lines = diff.split("\n");
  const hasHunk = lines.some((line) => line.startsWith("@@"));
  let inHunk = !hasHunk;
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("+")) added++;
    else if (line.startsWith("-")) removed++;
  }
  return { added, removed };
}

/** The old-file and new-file line a diff row sits on; either may be absent. */
export interface DiffRowNumbers {
  oldLine: number | null;
  newLine: number | null;
}

/**
 * The line numbers to draw beside each row of a unified diff, read off the
 * hunk headers: a context row has both, a removed row only the old file's, an
 * added row only the new file's. File headers, hunk headers and `\ No newline`
 * notes carry none.
 */
export function diffLineNumbers(lines: string[]): DiffRowNumbers[] {
  const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
  const none: DiffRowNumbers = { oldLine: null, newLine: null };
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;
  return lines.map((line) => {
    const header = hunk.exec(line);
    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      inHunk = true;
      return none;
    }
    if (!inHunk || line.startsWith("\\")) return none;
    if (line.startsWith("-")) return { oldLine: oldLine++, newLine: null };
    if (line.startsWith("+")) return { oldLine: null, newLine: newLine++ };
    return { oldLine: oldLine++, newLine: newLine++ };
  });
}

/** A span of characters inside a diff row's body, the marker column excluded. */
export interface IntralineRange {
  from: number;
  to: number;
}

const TOKEN = /\w+|\s+|[^\w\s]/g;
/** Longer rows, and runs with more rows than this, are left with the row tint. */
const MAX_INTRALINE_CHARS = 400;
const MAX_RUN_ROWS = 40;
/** Rows sharing less than this fraction of their text are not one edit. */
const MIN_SIMILARITY = 0.4;
/** A row changed through most of its length is a rewrite, not an edit. */
const MAX_CHANGED_FRACTION = 0.7;

interface TokenDiff {
  oldRanges: IntralineRange[];
  newRanges: IntralineRange[];
  /** Characters the two rows share, token for token. */
  shared: number;
}

/** Appends a span, joining it to the previous one when only blanks lie between. */
function pushRange(ranges: IntralineRange[], text: string, from: number, to: number): void {
  const last = ranges[ranges.length - 1];
  if (last && text.slice(last.to, from).trim() === "") last.to = to;
  else ranges.push({ from, to });
}

/** Compares two rows word by word and says which spans of each changed. */
function diffTokens(before: string, after: string): TokenDiff {
  const a = before.match(TOKEN) ?? [];
  const b = after.match(TOKEN) ?? [];
  const cols = b.length + 1;
  const table = new Uint16Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        a[i] === b[j]
          ? (table[(i + 1) * cols + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * cols + j] ?? 0, table[i * cols + j + 1] ?? 0);
    }
  }

  const oldRanges: IntralineRange[] = [];
  const newRanges: IntralineRange[] = [];
  let i = 0;
  let j = 0;
  let oldAt = 0;
  let newAt = 0;
  let shared = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      shared += a[i]!.length;
      oldAt += a[i]!.length;
      newAt += b[j]!.length;
      i++;
      j++;
    } else if (
      j >= b.length ||
      (i < a.length && (table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + j + 1] ?? 0))
    ) {
      pushRange(oldRanges, before, oldAt, oldAt + a[i]!.length);
      oldAt += a[i]!.length;
      i++;
    } else {
      pushRange(newRanges, after, newAt, newAt + b[j]!.length);
      newAt += b[j]!.length;
      j++;
    }
  }
  // A span of blanks only is indentation or spacing, which the row tint already
  // shows; marking it would draw an empty block at the start of the line.
  const visible = (text: string) => (range: IntralineRange) =>
    text.slice(range.from, range.to).trim() !== "";
  return {
    oldRanges: oldRanges.filter(visible(before)),
    newRanges: newRanges.filter(visible(after)),
    shared,
  };
}

function rangeLength(ranges: IntralineRange[]): number {
  return ranges.reduce((sum, range) => sum + (range.to - range.from), 0);
}

/**
 * Which parts of a changed line actually changed.
 *
 * Within a run of removed rows followed by added rows, each removed row is
 * paired with the most similar added row after the previous pair, and the two
 * are compared word by word. The map is keyed by row index. A row with no
 * partner, a pair with little in common, and a row rewritten through most of
 * its length get no entry and keep the plain whole-row tint.
 */
export function intralineRanges(lines: string[]): Map<number, IntralineRange[]> {
  const result = new Map<number, IntralineRange[]>();
  const hasHunk = lines.some((line) => line.startsWith("@@"));
  let inHunk = !hasHunk;

  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.startsWith("@@")) {
      inHunk = true;
      index++;
      continue;
    }
    if (!inHunk || !line.startsWith("-")) {
      index++;
      continue;
    }

    let removedEnd = index;
    while (removedEnd < lines.length && lines[removedEnd]!.startsWith("-")) removedEnd++;
    let addedEnd = removedEnd;
    while (addedEnd < lines.length && lines[addedEnd]!.startsWith("+")) addedEnd++;

    const removedCount = removedEnd - index;
    const addedCount = addedEnd - removedEnd;
    if (removedCount <= MAX_RUN_ROWS && addedCount <= MAX_RUN_ROWS) {
      let nextAdded = removedEnd;
      for (let row = index; row < removedEnd; row++) {
        const before = lines[row]!.slice(1);
        if (before.length > MAX_INTRALINE_CHARS) continue;

        let best: { row: number; diff: TokenDiff; score: number } | undefined;
        for (let candidate = nextAdded; candidate < addedEnd; candidate++) {
          const after = lines[candidate]!.slice(1);
          if (after.length > MAX_INTRALINE_CHARS || after === before) continue;
          const diff = diffTokens(before, after);
          const score = diff.shared / Math.max(before.length, after.length, 1);
          if (score >= MIN_SIMILARITY && (!best || score > best.score)) {
            best = { row: candidate, diff, score };
          }
        }
        if (!best) continue;

        const after = lines[best.row]!.slice(1);
        const changed = Math.max(
          rangeLength(best.diff.oldRanges) / Math.max(before.length, 1),
          rangeLength(best.diff.newRanges) / Math.max(after.length, 1),
        );
        nextAdded = best.row + 1;
        if (changed > MAX_CHANGED_FRACTION) continue;
        if (best.diff.oldRanges.length > 0) result.set(row, best.diff.oldRanges);
        if (best.diff.newRanges.length > 0) result.set(best.row, best.diff.newRanges);
      }
    }
    index = addedEnd;
  }
  return result;
}

/**
 * Moves every hunk header of a unified diff down by `by` lines. A diff built
 * from old and new text counts from the first line of its own snippet; once
 * the daemon has said where that snippet sits, the header and the numbers
 * drawn from it can name real file lines.
 */
export function offsetHunkHeaders(diff: string, by: number): string {
  if (by === 0) return diff;
  return diff
    .split("\n")
    .map((line) =>
      line.replace(
        /^@@ -(\d+)((?:,\d+)?) \+(\d+)((?:,\d+)?) @@/,
        (_, from: string, oldCount: string, to: string, newCount: string) =>
          `@@ -${Number(from) + by}${oldCount} +${Number(to) + by}${newCount} @@`,
      ),
    )
    .join("\n");
}
