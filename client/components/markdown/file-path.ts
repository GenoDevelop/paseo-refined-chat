import { FILE_EXTENSIONS } from "./link-style";

/**
 * A path as one token: an optional root (`C:\`, `~/`, `./`, `../`, `/`), folders,
 * then a name with an extension, then an optional line selector (`:55`, `:55:3`,
 * `:55-85`). No spaces: inline code with a space is a command or a sentence.
 */
const PATH_SHAPE =
  /^(?:[a-zA-Z]:[\\/]|~[\\/]|\.{1,2}[\\/]|[\\/])?(?:[\w.@+-]+[\\/])*[\w@+-][\w.@+-]*\.([a-zA-Z][a-zA-Z0-9]{0,9})(?::\d+(?:[:-]\d+)?)?$/;

/**
 * True when inline code reads as a file path worth offering to reveal. The
 * text is the agent's, so the test errs towards prose: a bare name needs an
 * extension from a short known list (`notes.ts`, not `v1.beta`), and a network
 * path (`\\host\share`, `//host/share`) is never a candidate, because looking
 * it up would make the machine contact that host.
 */
export function isFilePath(text: string): boolean {
  const path = text.trim();
  if (path === "" || path.length > 260 || /\s/.test(path)) return false;
  if (path.startsWith("\\\\") || path.startsWith("//") || path.includes("://")) return false;
  const match = PATH_SHAPE.exec(path);
  if (!match) return false;
  return /[\\/]/.test(path) || FILE_EXTENSIONS.has(match[1]!.toLowerCase());
}
