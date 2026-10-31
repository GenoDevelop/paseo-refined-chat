import { FILE_EXTENSIONS } from "./link-style";

const ROOT = String.raw`(?:[a-zA-Z]:[\\/]|~[\\/]|\.{1,2}[\\/]|[\\/])?`;

/**
 * A file as one token: an optional root (`C:\`, `~/`, `./`, `../`, `/`), folders,
 * then a name with an extension, then an optional line selector (`:55`, `:55:3`,
 * `:55-85`). No spaces: inline code with a space is a command or a sentence.
 */
const FILE_SHAPE = new RegExp(
  `^${ROOT}(?:[\\w.@+-]+[\\\\/])*[\\w@+-][\\w.@+-]*\\.([a-zA-Z][a-zA-Z0-9]{0,9})(?::\\d+(?:[:-]\\d+)?)?$`,
);

/** A folder that says so with its trailing separator: `src/`, `.\build\`. */
const FOLDER_SLASH_SHAPE = new RegExp(`^${ROOT}(?:\\.?[\\w@+-][\\w.@+-]*[\\\\/])+$`);

/** A folder named from a drive or the home folder, which prose never writes: `C:\work\app`, `~/app`. */
const FOLDER_ROOTED_SHAPE = /^(?:[a-zA-Z]:[\\/]|~[\\/])(?:[\w.@+-]+[\\/])*[\w@+-][\w.@+-]*$/;

export type PathKind = "file" | "folder";

/**
 * Whether inline code reads as a path worth offering to reveal. The text is the
 * agent's, so the test errs towards prose. A bare file name needs an extension
 * from a short known list (`notes.ts`, not `v1.beta`). A folder needs a trailing
 * separator, or a drive or `~` root: `and/or`, `/api/users` and `/compact` are
 * words and routes, not places. A network path (`\\host\share`, `//host/share`)
 * is never a candidate, because looking it up would make the machine contact
 * that host.
 */
export function pathKind(text: string): PathKind | null {
  const path = text.trim();
  if (path === "" || path.length > 260 || /\s/.test(path)) return null;
  if (path.startsWith("\\\\") || path.startsWith("//") || path.includes("://")) return null;
  const file = FILE_SHAPE.exec(path);
  if (file) {
    return /[\\/]/.test(path) || FILE_EXTENSIONS.has(file[1]!.toLowerCase()) ? "file" : null;
  }
  return FOLDER_SLASH_SHAPE.test(path) || FOLDER_ROOTED_SHAPE.test(path) ? "folder" : null;
}
