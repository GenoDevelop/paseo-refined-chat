import { useEffect, useMemo, useSyncExternalStore } from "react";

/**
 * Runs of consecutive cards, and the bar that hides all but the first of them.
 *
 * A plugin renderer knows only its own item, and the host hands it no
 * neighbours, so each timeline item reports where it sits in time and whether it
 * is a card (a tool call or a reasoning trace) or something that ends a run (a
 * reply, a prompt, a notice). The host projects history in list order and
 * timestamps follow it, so ordering by time rebuilds the list.
 *
 * Hiding goes through the timeline transformers: a card whose id is in the
 * hidden set is projected to no row at all, so it leaves no row spacing behind.
 * The host keeps what a transformer returned for each item, so after the set
 * changes the transformers are registered again (see `onHiddenChange`).
 *
 * A card that unmounts leaves the run, so a long run that the host draws only in
 * part is counted by what is drawn.
 */
interface Member {
  key: string;
  /** What the transformers know the card by; absent when they cannot tell it apart. */
  id: string | undefined;
  at: number;
  card: boolean;
}

/** A run that a press of the bar closed: its first card stays and draws the bar. */
interface ClosedRun {
  count: number;
  ids: string[];
}

/** A run is worth a bar once it has this many cards. */
export const MIN_RUN = 3;

/**
 * Cards drawn a few milliseconds apart are not in time order on screen (a call
 * is stamped when it settles), so stamps this close are a tie and the order the
 * cards mounted in, which follows the list, decides.
 */
const TIE = 2000;

const byAgent = new Map<string, Member[]>();
const closedRuns = new Map<string, ClosedRun>();
const hidden = new Set<string>();
const listeners = new Set<() => void>();
const hiddenListeners = new Set<() => void>();
let version = 0;

function publish(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = (): number => version;

/** Identity of a tool call for the transformers: its call id, when it has one. */
export function toolCardId(callId: string | undefined): string | undefined {
  return callId ? `tool:${callId}` : undefined;
}

/** Identity of a reasoning trace for the transformers: a hash of its text. */
export function reasoningCardId(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `reasoning:${hash >>> 0}:${text.length}`;
}

/** True when a bar has hidden the card; the transformers project it to nothing. */
export function isCardHidden(id: string): boolean {
  return hidden.has(id);
}

/** Calls `listener` after the hidden set changed; returns the way to stop. */
export function onHiddenChange(listener: () => void): () => void {
  hiddenListeners.add(listener);
  return () => {
    hiddenListeners.delete(listener);
  };
}

function add(agentId: string, member: Member): void {
  const list = byAgent.get(agentId) ?? [];
  const existing = list.findIndex((entry) => entry.key === member.key);
  if (existing !== -1) {
    if (list[existing]!.at === member.at) {
      list[existing] = member;
      publish();
      return;
    }
    list.splice(existing, 1);
  }
  let at = list.length;
  while (at > 0 && list[at - 1]!.at - TIE > member.at) at -= 1;
  list.splice(at, 0, member);
  byAgent.set(agentId, list);
  publish();
}

function remove(agentId: string, key: string): void {
  const list = byAgent.get(agentId);
  const index = list ? list.findIndex((entry) => entry.key === key) : -1;
  if (!list || index === -1) return;
  list.splice(index, 1);
  publish();
}

/** Reports one timeline item to the run store for as long as it is drawn. */
export function useRunMember(
  agentId: string,
  key: string,
  id: string | undefined,
  at: number,
  card: boolean,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;
    add(agentId, { key, id, at, card });
    return () => remove(agentId, key);
  }, [agentId, key, id, at, card, enabled]);
}

/** The run of cards that holds `key`, or null when it is not a card. */
function runOf(agentId: string, key: string): Member[] | null {
  const list = byAgent.get(agentId);
  const index = list ? list.findIndex((entry) => entry.key === key) : -1;
  if (!list || index === -1 || !list[index]!.card) return null;
  let start = index;
  while (start > 0 && list[start - 1]!.card) start -= 1;
  let end = index;
  while (end < list.length - 1 && list[end + 1]!.card) end += 1;
  return list.slice(start, end + 1);
}

export interface RunView {
  /** True for the first card of a run long enough to carry a bar, or of a closed run. */
  leads: boolean;
  /** Cards in the run, counting the hidden ones of a closed run. */
  count: number;
  closed: boolean;
  /** The cards a press of "Collapse all" hides: all but the first. */
  hide: string[];
}

export function useRunView(agentId: string, key: string): RunView | null {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useMemo(() => {
    const closedRun = closedRuns.get(key);
    if (closedRun) return { leads: true, count: closedRun.count, closed: true, hide: [] };
    const members = runOf(agentId, key);
    if (!members || members.length < MIN_RUN) return null;
    const hide = members.slice(1).flatMap((member) => (member.id ? [member.id] : []));
    return { leads: members[0]!.key === key, count: members.length, closed: false, hide };
    // `current` is the store's version: the run is recomputed when it moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, key, current]);
}

function notifyHidden(): void {
  for (const listener of hiddenListeners) listener();
}

/** Hides every card of the run but the first, which keeps drawing the bar. */
export function closeRun(key: string, view: RunView): void {
  closedRuns.set(key, { count: view.count, ids: view.hide });
  for (const id of view.hide) hidden.add(id);
  publish();
  notifyHidden();
}

/** Shows the cards a bar hid. */
export function openRun(key: string): void {
  const closedRun = closedRuns.get(key);
  if (!closedRun) return;
  closedRuns.delete(key);
  for (const id of closedRun.ids) hidden.delete(id);
  publish();
  notifyHidden();
}
