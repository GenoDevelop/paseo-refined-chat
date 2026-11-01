import { pathKind, type PathKind } from "./components/markdown/file-path";

/** A file or folder named in one line of command output. */
export interface OutputPath {
  /** Where the clickable text starts in the line. */
  start: number;
  /** Where it ends, past any `(12,5)` the path was written with. */
  end: number;
  /** What to open: the path, with its line written as `:12:5` whatever the tool wrote. */
  path: string;
  kind: PathKind;
}

/**
 * A run of path characters. Quotes, brackets, commas and `=` end a run, so
 * `--out=dist/a.js`, `(src/a.ts:3:1)` and `"x.py"` each give the path alone. A
 * path with a space in it is not found: the output does not say where it ends.
 */
const RUN = /[^\s"'`<>|*?(){}[\],;=!]+/g;

/** `a.cs(12,5)` and `a.ts(12)`, as MSBuild, tsc and Visual Studio write a position. */
const PAREN_POSITION = /^\((\d+)(?:,\s*(\d+))?\)/;

/** `File "x.py", line 12`, as Python writes a frame. */
const PYTHON_LINE = /^["'],?\s*line\s+(\d+)/;

/** A path with its line selector, then a colon and something that is not a column. */
const TEXT_AFTER_SELECTOR = /^(.+?:\d+(?:[:-]\d+)?):(?!\d)/;

/** A unified diff names `a/src/x.ts` and `b/src/x.ts`; neither prefix is a folder. */
const DIFF_HEADER = /^(?:diff --git|---|\+\+\+) /;

/**
 * The files and folders a line of command output names, which is what a reader
 * wants to press in a compiler error, a stack trace, a test failure or a
 * `git status`. The text is whatever the command printed, so it is as untrusted
 * as a path in a reply: this only finds candidates, and `pathKind` keeps the
 * test strict (a known extension or a separator, never a URL or a network path).
 * Pressing one reaches the same opener as a path in a reply, which never runs it.
 */
export function findOutputPaths(line: string): OutputPath[] {
  const found: OutputPath[] = [];
  const diffHeader = DIFF_HEADER.test(line);
  RUN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RUN.exec(line)) !== null) {
    // A sentence or a list puts a colon or a full stop after the name.
    let token = match[0].replace(/[:.]+$/, "");
    // `grep -n` joins the line number and the matched text with only a colon:
    // `a.ts:419:function f(`. The text after the selector is not the path's.
    token = TEXT_AFTER_SELECTOR.exec(token)?.[1] ?? token;
    let start = match.index;
    if (diffHeader) {
      const bare = token.replace(/^[ab]\//, "");
      start += token.length - bare.length;
      token = bare;
    }
    let end = start + token.length;

    let selector = "";
    if (!/:\d+(?:[:-]\d+)?$/.test(token)) {
      const rest = line.slice(end);
      const paren = PAREN_POSITION.exec(rest);
      const python = paren ? null : PYTHON_LINE.exec(rest);
      if (paren) {
        selector = paren[2] ? `:${paren[1]}:${paren[2]}` : `:${paren[1]}`;
        end += paren[0].length;
      } else if (python) {
        selector = `:${python[1]}`;
      }
    }

    const kind = pathKind(token + selector);
    if (kind) found.push({ start, end, path: token + selector, kind });
  }
  return found;
}
