import { useEffect, useRef, useState } from "react";

/** Folding fewer lines than this costs the reader a click for nothing. */
export const MIN_HIDDEN_LINES = 5;

export type FoldMode = "head" | "headTail";

export interface FoldPlan {
  /** Lines kept at the start. */
  head: number;
  /** Lines kept at the end; zero when only the start is shown. */
  tail: number;
  /** Lines the fold hides. */
  hidden: number;
}

/**
 * How a block of `total` lines folds under `limit` visible lines, or null when
 * it should stay whole: folding is off (limit 0), or it would hide too little
 * to be worth a click. `headTail` keeps the start and the end, since the end of
 * command output is where the error and the summary are.
 */
export function planFold(total: number, limit: number, mode: FoldMode): FoldPlan | null {
  if (!Number.isFinite(limit) || limit <= 0 || total - limit < MIN_HIDDEN_LINES) return null;
  if (mode === "head") return { head: limit, tail: 0, hidden: total - limit };
  const tail = Math.floor(limit / 2);
  const head = limit - tail;
  return { head, tail, hidden: total - head - tail };
}

/**
 * A block that can open itself. The find bar searches rendered text, and a
 * folded line is not rendered, so the bar asks every folded block whether it
 * holds the phrase and lets the ones that do open.
 */
interface Foldable {
  text(): string;
  /** Opens the block. Returns how to close it again, or null if it was open. */
  expand(): (() => void) | null;
}

const foldables = new Set<Foldable>();

/** Same word splitting and case rules as the find bar's own matching. */
function queryPattern(query: string): RegExp | null {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return new RegExp(
    words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"),
    "iu",
  );
}

/** True when `text` holds the phrase `query`, as the find bar reads one. */
export function textMatchesQuery(text: string, query: string): boolean {
  const pattern = queryPattern(query);
  return pattern !== null && pattern.test(text);
}

/**
 * Opens every folded block that holds `query`. Returns the functions that close
 * them again, so the find bar can put the page back when it is dismissed. One
 * letter matches nearly everything, so shorter phrases open nothing.
 */
export function revealMatching(query: string): (() => void)[] {
  if (query.trim().length < 2) return [];
  const restores: (() => void)[] = [];
  for (const foldable of foldables) {
    if (!textMatchesQuery(foldable.text(), query)) continue;
    const restore = foldable.expand();
    if (restore) restores.push(restore);
  }
  return restores;
}

/**
 * Open and closed state of one foldable block. `folded` is true while the plan
 * applies and the reader has not opened it; the block registers with the find
 * bar for exactly that time.
 */
export function useFold(
  text: string,
  plan: FoldPlan | null,
): { folded: boolean; open: boolean; setOpen(open: boolean): void } {
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  const foldable = plan !== null;

  useEffect(() => {
    if (!foldable) return;
    const entry: Foldable = {
      text: () => text,
      expand: () => {
        if (openRef.current) return null;
        setOpen(true);
        return () => setOpen(false);
      },
    };
    foldables.add(entry);
    return () => {
      foldables.delete(entry);
    };
  }, [foldable, text]);

  return { folded: foldable && !open, open: foldable && open, setOpen };
}
