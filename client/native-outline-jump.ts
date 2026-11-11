import type { OutlineEntry } from "./conversation-outline";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

/** Read-only discovery of the current chat's private navigation bindings. */
export function nativeChatBindings(node: object, agentId: string, serverId: string, entry?: OutlineEntry, epoch = ""): Record<string, unknown> | null {
  const key = Object.keys(node).find(key => key.startsWith("__reactFiber$"));
  let fiber = key ? record(record(node)[key]) : {};
  let fallback: Record<string, unknown> | null = null;
  for (let depth = 0; depth < 100 && Object.keys(fiber).length; depth++) {
    for (const candidate of [fiber, record(fiber.alternate)]) {
      const props = record(candidate.memoizedProps);
      const viewport = record(record(props.viewportRef).current);
      if (props.agentId === agentId && props.serverId === serverId && Array.isArray(props.items)
        && typeof viewport.scrollToMessage === "function") {
        if (!entry || nativeMessageId(props.items, entry, epoch)) return props;
        fallback ??= props;
      }
    }
    fiber = record(fiber.return);
  }
  return fallback;
}

export function nativeMessageId(items: unknown[], entry: OutlineEntry, epoch: string): string | null {
  for (const value of items) {
    const item = record(value);
    if (typeof item.id !== "string") continue;
    const data = item.kind === "tool_call" ? record(record(item.payload).data) : record(item.data);
    const cursor = record(item.timelineCursor);
    if ((entry.callId && data.callId === entry.callId)
      || (entry.messageId && item.id === entry.messageId)
      || (cursor.epoch === epoch && cursor.seq === entry.seq)) return item.id;
  }
  return null;
}

export function mountedOutlineRow(chat: HTMLElement, agentId: string, entry: OutlineEntry): HTMLElement | null {
  const row = entry.callId ? document.getElementById(`refined-outline:${agentId}:${entry.callId}`)
    : [...chat.querySelectorAll<HTMLElement>("[data-history-row-id]")].find(node => Boolean(entry.messageId) && node.dataset.historyRowId === entry.messageId);
  if (!row || !chat.contains(row) || !row.getClientRects().length
    || (entry.callId && row.querySelector('[data-outline-card-open="false"]'))) return null;
  return row;
}

interface JumpLayout { row: object; top: number; height: number; viewportHeight: number; scrollTop: number }
interface JumpSettlement { layout: JumpLayout; since: number; done: boolean }
/** A mounted target is insufficient: grouping and height measurements must settle. */
export function settleOutlineJump(previous: JumpSettlement | null, layout: JumpLayout, now: number, corrected: boolean): JumpSettlement {
  const same = previous && !corrected && previous.layout.row === layout.row
    && (["top", "height", "viewportHeight", "scrollTop"] as const)
      .every(key => Math.abs(previous.layout[key] - layout[key]) <= 1);
  const since = same ? previous.since : now;
  return { layout, since, done: now - since >= 600 };
}

/** Optional desktop adapter. No module numbers, writes to React, or host patches. */
export async function nativeOutlineJump(
  serverId: string, agentId: string, epoch: string, entry: OutlineEntry,
  signal: AbortSignal, reveal: () => void,
): Promise<string | null> {
  if (typeof document === "undefined" || signal.aborted) return "Jump canceled.";
  if (!epoch || !Number.isSafeInteger(entry.seq) || entry.seq < 0) return "Refresh the outline before jumping.";
  const visibleChats = [...document.querySelectorAll<HTMLElement>('[data-testid="agent-chat-scroll"]')].filter(node => node.getClientRects().length);
  const chat = visibleChats.find(node => nativeChatBindings(node, agentId, serverId))
    ?? visibleChats.find(node => mountedOutlineRow(node, agentId, entry));
  const runtime = record(Reflect.get(globalThis, "__paseoHostRuntimeStore"));
  if (!chat || (!mountedOutlineRow(chat, agentId, entry) && typeof runtime.fetchAgentTimeline !== "function")) {
    return "Native navigation is unavailable in this Paseo version. The entry is still readable here.";
  }
  const cancel = () => controller.abort();
  const controller = new AbortController();
  const externalCancel = () => controller.abort();
  signal.addEventListener("abort", externalCancel, { once: true });
  chat.addEventListener("wheel", cancel, { passive: true });
  chat.addEventListener("touchstart", cancel, { passive: true });
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const canceled = new Promise<null>(resolve => controller.signal.addEventListener("abort", () => resolve(null), { once: true }));
    if (!mountedOutlineRow(chat, agentId, entry)) {
      const response = await Promise.race([(runtime.fetchAgentTimeline as Function).call(runtime, serverId, agentId, {
        direction: "before", cursor: { epoch, seq: entry.seq + 21 }, limit: 40,
        projection: "projected", wholeTurns: true, mergeWindow: true,
      }), canceled]);
      if (signal.aborted || controller.signal.aborted) return "Jump canceled.";
      const result = record(response);
      if (result.error || result.staleCursor || result.epoch !== epoch) return "History changed. Refresh the outline and try again.";
    }
    reveal();
    const deadline = Date.now() + 8000;
    let scrolled = "";
    let settlement: JumpSettlement | null = null;
    while (Date.now() < deadline && !signal.aborted && !controller.signal.aborted) {
      reveal();
      const bindings = nativeChatBindings(chat, agentId, serverId, entry, epoch);
      if (!bindings && !mountedOutlineRow(chat, agentId, entry)) return "The active conversation changed. Jump canceled.";
      const id = bindings ? nativeMessageId(bindings.items as unknown[], entry, epoch) : null;
      if (id) {
        const revealMessage = bindings!.revealLoadedMessage;
        const expanded = typeof revealMessage === "function" && revealMessage(id);
        if (!expanded && scrolled !== id) {
          const viewport = record(record(bindings!.viewportRef).current);
          const scroll = viewport.scrollToMessage;
          if (typeof scroll !== "function") break;
          Promise.resolve(scroll.call(viewport, id, { signal: controller.signal,
            targetTop: () => {
              const row = mountedOutlineRow(chat, agentId, entry);
              return row ? row.getBoundingClientRect().top - 16 : null;
            },
          })).catch(() => controller.abort());
          scrolled = id;
        }
      }
      const row = mountedOutlineRow(chat, agentId, entry);
      if (row) {
        const viewport = chat.getBoundingClientRect();
        const bounds = row.getBoundingClientRect();
        const wanted = Math.max(0, Math.min(chat.scrollHeight - chat.clientHeight, chat.scrollTop + bounds.top - viewport.top - 16));
        const corrected = Math.abs(wanted - chat.scrollTop) > 1;
        if (corrected) chat.scrollTop = wanted;
        const actual = row.getBoundingClientRect();
        settlement = settleOutlineJump(settlement, { row, top: actual.top - viewport.top, height: actual.height,
          viewportHeight: chat.clientHeight, scrollTop: chat.scrollTop }, Date.now(), corrected);
        if (settlement.done) {
          row.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: 500 });
          return null;
        }
      } else settlement = null;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    return signal.aborted || controller.signal.aborted ? "Jump canceled." : "Paseo could not reveal this entry. Its content is still available here.";
  } catch {
    return "Native navigation failed. The entry is still readable here.";
  } finally {
    controller.abort();
    clearTimeout(timeout);
    signal.removeEventListener("abort", externalCancel);
    chat.removeEventListener("wheel", cancel);
    chat.removeEventListener("touchstart", cancel);
  }
}
