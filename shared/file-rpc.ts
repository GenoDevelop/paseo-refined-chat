import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

/**
 * Strips the selector a tool appends to a path, such as `main.ts:55-85`.
 * Spaces stay: they are part of a file name such as `my shot.png`.
 */
export function stripSelector(path: string): string {
  const trimmed = path.trim();
  const drive = /^[a-zA-Z]:[\\/]/.test(trimmed);
  const head = drive ? trimmed.slice(0, 3) : "";
  const tail = drive ? trimmed.slice(3) : trimmed;
  const cut = tail.search(/[:?#]/);
  return cut === -1 ? trimmed : head + tail.slice(0, cut);
}

/**
 * The line a path's selector names (`main.ts:55`, `main.ts:55-85`, `main.ts:55:3`),
 * or null when there is none. A range or column gives its first number.
 */
export function lineSelector(path: string): number | null {
  const trimmed = path.trim();
  const tail = /^[a-zA-Z]:[\\/]/.test(trimmed) ? trimmed.slice(3) : trimmed;
  const match = /:(\d+)(?:[:-]\d+)?$/.exec(tail);
  const line = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(line) && line > 0 ? line : null;
}

/**
 * Shows a path in the machine's own file manager.
 *
 * The client cannot reach the operating system, and Paseo exposes no file
 * navigation to plugins, so the daemon side does the work: it resolves the
 * path against the agent's working directory and asks the platform shell to
 * reveal it.
 */
export const revealPathRpc = defineRpc({
  // The host accepts lower-case, dotted RPC names only.
  name: "file.reveal",
  input: z.object({
    cwd: z.string(),
    path: z.string(),
  }),
  output: z.object({
    revealed: z.string().nullable(),
    error: z.string().nullable(),
  }),
});

/**
 * Finds where a piece of text sits in a file.
 *
 * An edit reaches the chat as the text it replaced and the text it wrote, with
 * no position, so its diff cannot say which lines it touched. The daemon can
 * read the file: when the written text occurs exactly once, its first line is
 * where the edit landed. Anything else (missing file, no match, several
 * matches) answers `null`, and the card draws no line numbers rather than a
 * wrong one.
 */
export const locateTextRpc = defineRpc({
  // The host accepts lower-case, dotted RPC names only.
  name: "file.locate",
  input: z.object({
    cwd: z.string(),
    path: z.string(),
    text: z.string(),
  }),
  output: z.object({
    line: z.number().nullable(),
  }),
});

/** The largest file the side panel reads: a text file this big already fills a screen many times. */
export const MAX_PREVIEW_BYTES = 1024 * 1024;

/**
 * Reads a text file for the side panel.
 *
 * The path comes from the agent's reply, and this call returns file contents,
 * so it is stricter than `file.reveal`: the file must sit inside the agent's
 * working directory once symbolic links are resolved, be at most
 * `MAX_PREVIEW_BYTES`, and be text. Any other file answers with the reason and
 * no contents, and the panel offers the file manager instead. `anywhere` is the
 * reader's own setting and lifts the working-directory rule only; network
 * paths, size and the text check still apply.
 */
export const readFileRpc = defineRpc({
  // The host accepts lower-case, dotted RPC names only.
  name: "file.read",
  input: z.object({
    cwd: z.string(),
    path: z.string(),
    anywhere: z.boolean().optional(),
  }),
  output: z.object({
    text: z.string().nullable(),
    /** Why there is no text: `outside` the working directory, `binary`, `large`, or `missing`. */
    reason: z.enum(["outside", "binary", "large", "missing"]).nullable(),
  }),
});
