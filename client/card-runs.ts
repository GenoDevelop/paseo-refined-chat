import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { ViewProps } from "react-native";
import type { CardRunCollapsePreference } from "./preferences";
import type { CollapseKind } from "./tool-collapse";

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
 * Whether a run is hidden is all this does to its cards. Whether a card is open
 * is the card's own state (see `card-state`), and the two do not touch.
 *
 * A card that unmounts leaves the run, so a long run that the host draws only in
 * part is counted by what is drawn.
 */

/** Where a card is in its call: still going, done, or ended in failure. */
export type CardStatus = "running" | "done" | "failed";

type KindCounts = Partial<Record<CollapseKind, number>>;

interface Member {
  key: string;
  /** What the transformers know the card by; absent when they cannot tell it apart. */
  id: string | undefined;
  at: number;
  card: boolean;
  kind?: CollapseKind;
  status: CardStatus;
  /** The row this item draws, once it is in the page; the order on screen is its order. */
  el: Node | null;
}

/** A run that was closed: its first card stays and draws the bar alone. */
interface ClosedRun {
  count: number;
  ids: string[];
  kinds: KindCounts;
  /** The kind of each hidden card, to tell whether a failure of it keeps the run open. */
  kindOf: Record<string, CollapseKind>;
  /** True when the collapse rule closed it, so it may take in the cards that follow. */
  auto: boolean;
  /** The first card, which stays drawn: what other records find this one by. */
  leaderId?: string;
  leaderKind?: CollapseKind;
}

/** A run is worth a bar once it has this many cards. */
export const MIN_RUN = 2;

/**
 * Cards drawn a few milliseconds apart are not in time order on screen (a call
 * is stamped when it settles), so stamps this close are a tie and the order the
 * cards mounted in, which follows the list, decides.
 */
const TIE = 2000;

/**
 * Marks the root of a timeline item so the run store can find it on the page.
 * It also carries the host-font opt-out the other roots of this plugin carry.
 */
export function runRowProps(key: string): ViewProps {
  return {
    dataSet: { pmono: true, prow: key },
  } as unknown as ViewProps;
}

const byAgent = new Map<string, Member[]>();
const closedRuns = new Map<string, ClosedRun>();
const hidden = new Set<string>();
/** Runs the reader opened or closed with the bar: the collapse rule leaves them alone. */
const touched = new Set<string>();
/** The state of hidden cards, as the transformers still see them. */
const reported = new Map<string, CardStatus>();
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

/**
 * Lets the bar of a closed run know how a hidden card is doing. The transformers
 * see every update of an item, hidden or not, and call this from there.
 */
export function noteCardStatus(id: string, status: CardStatus): void {
  if (reported.get(id) === status) return;
  reported.set(id, status);
  // A transformer runs while the host projects, not in a handler: leave the
  // store's listeners for after it.
  queueMicrotask(publish);
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
  if (existing === -1) list.push(member);
  else list[existing] = member;
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

function update(agentId: string, key: string, kind: CollapseKind | undefined, status: CardStatus) {
  const member = byAgent.get(agentId)?.find((entry) => entry.key === key);
  if (!member || (member.kind === kind && member.status === status)) return;
  member.kind = kind;
  member.status = status;
  publish();
}

/** What a card tells the run store about itself. */
export interface CardInfo {
  kind: CollapseKind;
  status: CardStatus;
}

/**
 * A card is stamped when it settles, so its key changes while it runs. What the
 * run store holds under the old key moves to the new one, or the cards that a
 * closed run hid would stay hidden with nothing to count or open them.
 */
function rekey(from: string, to: string): void {
  const closedRun = closedRuns.get(from);
  if (closedRun) {
    closedRuns.delete(from);
    closedRuns.set(to, closedRun);
  }
  if (touched.delete(from)) touched.add(to);
  if (closedRun) publish();
}

/** The page element of the item that reported `key`, once it has been drawn. */
function findRow(key: string): Node | null {
  if (typeof document === "undefined") return null;
  return document.querySelector(`[data-prow="${key.replace(/["\\]/g, "\\$&")}"]`);
}

/**
 * Reports one timeline item to the run store for as long as it is drawn. A
 * card passes `info`; an item that only ends a run passes none.
 */
export function useRunMember(
  agentId: string,
  key: string,
  id: string | undefined,
  at: number,
  info: CardInfo | undefined,
  enabled: boolean,
): void {
  const card = info !== undefined;
  const kind = info?.kind;
  const status = info?.status ?? "done";
  const previousKey = useRef(key);
  useEffect(() => {
    if (!enabled) return;
    if (previousKey.current !== key) rekey(previousKey.current, key);
    previousKey.current = key;
    add(agentId, { key, id, at, card, kind, status, el: findRow(key) });
    return () => remove(agentId, key);
    // The kind and status change while a call runs. They are not dependencies:
    // adding the card again would move it among ties; the effect below updates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, key, id, at, card, enabled]);
  useEffect(() => {
    if (enabled) update(agentId, key, kind, status);
  }, [agentId, key, kind, status, enabled]);
}

/** The run of cards that holds `key`, or null when it is not a card. */
/**
 * The items of an agent in the order they are on screen. The page is the truth:
 * the stamps of cards are not (a call is stamped when it settles, so one that
 * ran long can be stamped after the prompt that follows it). Items not yet in
 * the page, and pages that are not a DOM, fall back to the stamps.
 */
function ordered(list: Member[] | undefined): Member[] | undefined {
  if (!list) return list;
  const sorted = [...list].sort((a, b) => {
    if (a.el?.isConnected && b.el?.isConnected) {
      const position = a.el.compareDocumentPosition(b.el);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    }
    return Math.abs(a.at - b.at) < TIE ? 0 : a.at - b.at;
  });
  // A list drawn newest first reads backwards: the stamps say which way it runs.
  let later = 0;
  let earlier = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const step = sorted[i]!.at - sorted[i - 1]!.at;
    if (step > 0) later += 1;
    else if (step < 0) earlier += 1;
  }
  return earlier > later ? sorted.reverse() : sorted;
}

function runOf(agentId: string, key: string): Member[] | null {
  const list = ordered(byAgent.get(agentId));
  const index = list ? list.findIndex((entry) => entry.key === key) : -1;
  if (!list || index === -1 || !list[index]!.card) return null;
  let start = index;
  while (start > 0 && list[start - 1]!.card) start -= 1;
  let end = index;
  while (end < list.length - 1 && list[end + 1]!.card) end += 1;
  return list.slice(start, end + 1);
}

function countKinds(members: Member[]): KindCounts {
  const counts: KindCounts = {};
  for (const member of members) {
    if (member.kind) counts[member.kind] = (counts[member.kind] ?? 0) + 1;
  }
  return counts;
}

/** The kind of every card in `members` that the transformers can tell apart. */
function kindsById(members: Member[]): Record<string, CollapseKind> {
  const kinds: Record<string, CollapseKind> = {};
  for (const member of members) if (member.id && member.kind) kinds[member.id] = member.kind;
  return kinds;
}

function addKinds(into: KindCounts, more: KindCounts): KindCounts {
  const counts: KindCounts = { ...into };
  for (const [kind, n] of Object.entries(more) as [CollapseKind, number][]) {
    counts[kind] = (counts[kind] ?? 0) + n;
  }
  return counts;
}

const PHRASES: Record<CollapseKind, [one: string, many: string]> = {
  shell: ["ran 1 command", "ran # commands"],
  read: ["read 1 file", "read # files"],
  edit: ["edited 1 file", "edited # files"],
  write: ["wrote 1 file", "wrote # files"],
  other: ["used 1 other tool", "used # other tools"],
  thinking: ["1 thought", "# thoughts"],
};
const PHRASE_ORDER: CollapseKind[] = ["shell", "read", "edit", "write", "other", "thinking"];

/** "Ran 3 commands, read 2 files, 1 thought": what the cards of a run did. */
export function describeKinds(counts: KindCounts, total: number): string {
  const parts = PHRASE_ORDER.flatMap((kind) => {
    const n = counts[kind] ?? 0;
    if (n === 0) return [];
    return [n === 1 ? PHRASES[kind][0] : PHRASES[kind][1].replace("#", String(n))];
  });
  if (parts.length === 0) return `${total} steps`;
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface RunView {
  /** True for the first card of a run long enough to carry a bar, or of a closed run. */
  leads: boolean;
  /** Cards in the run, counting the hidden ones of a closed run. */
  count: number;
  closed: boolean;
  /** What the cards did, in words. */
  summary: string;
  /** Some card of the run is still going. */
  running: boolean;
  /** How many cards ended in failure. */
  failed: number;
  /** The cards a close hides: all but the first, those that can be told apart. */
  hide: string[];
  /** For a closed run, the cards after its first that are drawn again. */
  extra: Member[];
  /** Every card of the run that is drawn. */
  members: Member[];
}

export function useRunView(agentId: string, key: string): RunView | null {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useMemo(() => {
    const members = runOf(agentId, key);
    const closedRun = closedRuns.get(key);
    // A run that closed before the older cards of its own run had mounted is no
    // longer first: it is drawn as a plain card until the run takes it in.
    if (closedRun && (!members || members[0]!.key === key)) {
      const drawn = members ?? [];
      const hiddenStates = closedRun.ids.map((id) => reported.get(id));
      return {
        leads: true,
        count: closedRun.count,
        closed: true,
        summary: describeKinds(closedRun.kinds, closedRun.count),
        running:
          hiddenStates.includes("running") || drawn.some((member) => member.status === "running"),
        failed:
          hiddenStates.filter((state) => state === "failed").length +
          drawn.filter((member) => member.status === "failed").length,
        hide: [],
        extra: drawn.slice(1),
        members: drawn,
      };
    }
    if (!members || members.length < MIN_RUN) return null;
    return {
      leads: members[0]!.key === key,
      count: members.length,
      closed: false,
      summary: describeKinds(countKinds(members), members.length),
      running: members.some((member) => member.status === "running"),
      failed: members.filter((member) => member.status === "failed").length,
      hide: members
        .slice(1)
        .filter(settled)
        .flatMap((member) => (member.id ? [member.id] : [])),
      extra: [],
      members,
    };
    // `current` is the store's version: the run is recomputed when it moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, key, current]);
}

function notifyHidden(): void {
  for (const listener of hiddenListeners) listener();
}

/**
 * Runs that closed while this run was only partly mounted (history mounts in no
 * fixed order, and scrolling up mounts older cards last) and are now drawn
 * inside it.
 */
/**
 * A reasoning trace that is still streaming changes its text, and so its id, with
 * every update: hiding it would hide one id and show the next. It joins a run
 * once it is done.
 */
function settled(member: Member): boolean {
  return !(member.kind === "thinking" && member.status === "running");
}

function nestedRuns(members: Member[]): string[] {
  return members.slice(1).flatMap((member) => (closedRuns.has(member.key) ? [member.key] : []));
}

/** What `cards` add to a run once the closed runs inside them count too. */
function absorb(cards: Member[]): ClosedRun {
  const run: ClosedRun = {
    count: cards.length,
    ids: cards.flatMap((member) => (member.id ? [member.id] : [])),
    kinds: countKinds(cards),
    kindOf: kindsById(cards),
    auto: true,
  };
  for (const key of nestedRuns(cards)) {
    const inner = closedRuns.get(key)!;
    // Its first card is among `cards` already; its hidden ones are not.
    run.count += inner.count - 1;
    run.ids.push(...inner.ids);
    run.kinds = addKinds(run.kinds, inner.kinds);
    // The kinds of `inner` count its first card too, and `cards` counted it.
    const first = cards.find((card) => card.key === key)?.kind;
    if (first) run.kinds[first] = (run.kinds[first] ?? 1) - 1;
    run.kindOf = { ...run.kindOf, ...inner.kindOf };
    closedRuns.delete(key);
  }
  // A run whose first card is hidden by this one, and that is not drawn to be
  // found by its key, goes the same way: its first card is counted already.
  for (let merged = true; merged; ) {
    merged = false;
    for (const [key, inner] of closedRuns) {
      if (!inner.leaderId || !run.ids.includes(inner.leaderId)) continue;
      run.count += inner.count - 1;
      run.ids.push(...inner.ids);
      run.kinds = addKinds(run.kinds, inner.kinds);
      if (inner.leaderKind) run.kinds[inner.leaderKind] = (run.kinds[inner.leaderKind] ?? 1) - 1;
      run.kindOf = { ...run.kindOf, ...inner.kindOf };
      closedRuns.delete(key);
      merged = true;
    }
  }
  return run;
}

/** Shows the cards of runs nested in `members`, for a run that does not close. */
function releaseNested(members: Member[]): void {
  const nested = nestedRuns(members);
  if (nested.length === 0) return;
  for (const key of nested) {
    for (const id of closedRuns.get(key)!.ids) hidden.delete(id);
    closedRuns.delete(key);
  }
  publish();
  notifyHidden();
}

function closeWith(key: string, view: RunView, auto: boolean): void {
  const rest = absorb(view.members.slice(1).filter(settled));
  closedRuns.set(key, {
    count: rest.count + 1,
    ids: rest.ids,
    kinds: addKinds(rest.kinds, countKinds(view.members.slice(0, 1))),
    kindOf: rest.kindOf,
    auto,
    leaderId: view.members[0]?.id,
    leaderKind: view.members[0]?.kind,
  });
  for (const id of rest.ids) hidden.add(id);
  publish();
  notifyHidden();
}

/** The reader closed the run with the bar: hides every card but the first. */
export function closeRun(key: string, view: RunView): void {
  touched.add(key);
  closeWith(key, view, false);
}

/** The reader opened the run with the bar: shows the cards that were hidden. */
export function openRun(key: string): void {
  touched.add(key);
  const closedRun = closedRuns.get(key);
  if (!closedRun) return;
  closedRuns.delete(key);
  for (const id of closedRun.ids) hidden.delete(id);
  publish();
  notifyHidden();
}

/** Cards that follow a closed run's first can join it: hides them and counts them. */
function takeIn(key: string, view: RunView): void {
  const closedRun = closedRuns.get(key);
  if (!closedRun) return;
  // A card just hidden stays drawn until the host projects the list again, and
  // the view recomputes meanwhile: count each card once. A card the transformers
  // cannot tell apart cannot be hidden, so it is not part of the run either.
  const more = absorb(view.extra.filter((member) => member.id && settled(member) && !hidden.has(member.id)));
  if (more.ids.length === 0) return;
  closedRuns.set(key, {
    count: closedRun.count + more.count,
    ids: [...closedRun.ids, ...more.ids],
    kinds: addKinds(closedRun.kinds, more.kinds),
    kindOf: { ...closedRun.kindOf, ...more.kindOf },
    auto: closedRun.auto,
    leaderId: closedRun.leaderId,
    leaderKind: closedRun.leaderKind,
  });
  for (const id of more.ids) hidden.add(id);
  publish();
  notifyHidden();
}

/**
 * How many failed cards keep the run open. A failed card stays open unless its
 * kind starts collapsed, and a run follows its cards.
 */
function pinning(key: string, view: RunView, startCollapsed: readonly CollapseKind[]): number {
  const pins = (kind: CollapseKind | undefined) => !kind || !startCollapsed.includes(kind);
  const drawn = view.members.filter((member) => member.status === "failed" && pins(member.kind));
  const closedRun = closedRuns.get(key);
  const hiddenFailed = closedRun
    ? closedRun.ids.filter((id) => reported.get(id) === "failed" && pins(closedRun.kindOf[id]))
    : [];
  return drawn.length + hiddenFailed.length;
}

/**
 * Applies the collapse rule to the run `view` leads. A run the reader opened or
 * closed is left alone. A failed card keeps its run open, as it keeps itself
 * open, unless its kind starts collapsed; a run that closed by itself opens
 * again when such a card fails, and stays as it is from then on. A run whose
 * cards cannot all be hidden is not closed, because it would only look half done.
 */
export function applyCollapseRule(
  key: string,
  view: RunView,
  rule: CardRunCollapsePreference,
  startCollapsed: readonly CollapseKind[],
): void {
  if (!view.leads) return;
  const auto = rule !== "never" && !touched.has(key);
  const pinned = auto && pinning(key, view, startCollapsed) > 0;
  if (view.closed) {
    if (auto && closedRuns.get(key)?.auto) {
      if (pinned) return openRun(key);
      if (rule === "always" || !view.running) return takeIn(key, view);
    }
  } else if (
    auto &&
    !pinned &&
    view.hide.length === view.count - 1 &&
    (rule === "always" || !view.running)
  ) {
    return closeWith(key, view, true);
  }
  // Nothing absorbs the closed runs drawn inside this one, so they open.
  releaseNested(view.members);
}
