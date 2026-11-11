/**
 * Whether a card is open, and whether the reader pressed it, kept by card key.
 *
 * A bar over a run of cards hides cards by removing them from the timeline, which
 * unmounts them. Showing them again must give each back the state it had, so a
 * card the reader opened is still open and a card that folded itself is still
 * folded. This is the only link between hiding a group and a card's own state.
 */
interface CardState {
  expanded: boolean;
  touched: boolean;
}

const saved = new Map<string, CardState>();
const pendingReveals = new Set<string>();
const revealListeners = new Map<string, Set<() => void>>();

/** Explicit navigation opens a mounted card, or waits until its group mounts it. */
export function requestCardReveal(key: string): void {
  const listeners = revealListeners.get(key);
  if (listeners?.size) listeners.forEach(listener => listener());
  else pendingReveals.add(key);
}

export function cancelCardReveal(key: string): void {
  pendingReveals.delete(key);
}

export function subscribeCardReveal(key: string, reveal: () => void): () => void {
  let listeners = revealListeners.get(key);
  if (!listeners) { listeners = new Set(); revealListeners.set(key, listeners); }
  listeners.add(reveal);
  if (pendingReveals.delete(key)) reveal();
  return () => {
    listeners.delete(reveal);
    if (!listeners.size) revealListeners.delete(key);
  };
}

export function savedCardState(key: string | undefined): CardState | undefined {
  return key ? saved.get(key) : undefined;
}

export function saveCardState(key: string | undefined, state: CardState): void {
  if (key) saved.set(key, state);
}
