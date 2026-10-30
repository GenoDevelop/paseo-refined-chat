import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

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
