/** Where a link inside a file shown in the side panel leads. */
export interface FileLink {
  /** A file beside the current one, as the link wrote it; null for the current file. */
  path: string | null;
  /** A `#L55` line, GitHub style. */
  line: number | null;
  /** A heading's slug (`#usage`), lower case. */
  anchor: string | null;
}

/**
 * Reads a link that stays inside the files on disk: `docs/TESTING.md`,
 * `../README.md#L12`, `#usage`, `docs/X.md#usage`. Anything with a scheme
 * (`https:`, `mailto:`), a root (`/x`, `C:\x`, `~/x`) or a folder (`docs/`) is
 * not one, and keeps its own behaviour; so does an empty link.
 */
export function parseFileLink(href: string): FileLink | null {
  const text = href.trim();
  if (text === "" || text.startsWith("//")) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(text)) return null;
  if (/^[\\/~]/.test(text)) return null;

  const hash = text.indexOf("#");
  const query = text.search(/[?#]/);
  let path = query === -1 ? text : text.slice(0, query);
  try {
    path = decodeURIComponent(path);
  } catch {
    // A stray `%` stays as typed.
  }
  if (/[\\/]$/.test(path)) return null;

  let fragment = hash === -1 ? "" : text.slice(hash + 1);
  try {
    fragment = decodeURIComponent(fragment);
  } catch {
    // As above.
  }
  const lineMatch = /^L(\d+)(?:-L?\d+)?$/.exec(fragment);
  const line = lineMatch ? Number(lineMatch[1]) : null;
  const anchor = fragment !== "" && !lineMatch ? fragment.toLowerCase() : null;
  if (path === "" && line === null && anchor === null) return null;
  return { path: path === "" ? null : path, line, anchor };
}

/**
 * The path a relative link points at, from the file that holds it. `from` is a
 * path as the panel shows it: relative to the working directory, or rooted.
 * `..` steps climb out of folders but never past a root, and a relative path
 * that climbs out of the working directory keeps its `..`: the daemon refuses it.
 */
export function siblingPath(from: string, link: string): string {
  const root = /^(?:[a-zA-Z]:[\\/]|~[\\/]|[\\/])/.exec(from)?.[0] ?? "";
  const rest = from.slice(root.length).split(/[\\/]/);
  rest.pop();

  const parts = rest.filter((part) => part !== "" && part !== ".");
  for (const part of link.split(/[\\/]/)) {
    if (part === "" || part === ".") continue;
    if (part !== "..") {
      parts.push(part);
    } else if (parts.length > 0 && parts[parts.length - 1] !== "..") {
      parts.pop();
    } else if (root === "") {
      parts.push("..");
    }
  }
  return root + parts.join("/");
}

/**
 * The anchor each heading gets, as GitHub makes it: lower case, anything but
 * letters, digits, spaces, hyphens and underscores dropped, spaces turned into
 * hyphens, and a repeated slug numbered (`usage`, `usage-1`).
 */
export function headingSlugs(titles: string[]): string[] {
  const seen = new Map<string, number>();
  return titles.map((title) => {
    const base = title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .replace(/\s/g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  });
}
