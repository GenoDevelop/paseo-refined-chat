import { useEffect, useState } from "react";
import { useRpc } from "@getpaseo/plugin/client";
import { locateTextRpc } from "../shared/file-rpc";

/**
 * The file line an edit landed on, or null when that cannot be told.
 *
 * Undefined means "not asked": the call is not an edit built from old and new
 * text, so there is nothing to locate. The answer reflects the file as it is
 * now, so a later edit above this one can shift it; a card that cannot be sure
 * draws no numbers at all rather than a wrong one.
 */
export function useEditAnchor(
  path: string | undefined,
  cwd: string | null,
  text: string | undefined,
  finished: boolean,
): number | null | undefined {
  const locate = useRpc(locateTextRpc);
  const [line, setLine] = useState<number | null>(null);
  // The card exists while the edit is still running, and the file does not
  // hold the new text until it finishes: asking earlier would find nothing and
  // never ask again.
  const wanted = finished && path !== undefined && text !== undefined;

  useEffect(() => {
    if (!wanted || path === undefined || text === undefined) {
      setLine(null);
      return;
    }
    let cancelled = false;
    locate({ cwd: cwd ?? "", path, text })
      .then((result) => {
        if (!cancelled) setLine(result.line);
      })
      .catch(() => {
        if (!cancelled) setLine(null);
      });
    return () => {
      cancelled = true;
    };
  }, [locate, wanted, path, cwd, text]);

  return wanted ? line : undefined;
}
