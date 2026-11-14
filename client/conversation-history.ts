import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePaseo } from "@getpaseo/plugin/client";
type AgentHistoryHandle = ReturnType<ReturnType<typeof usePaseo>["agents"]["ref"]>;
type HistoryCursor = NonNullable<Parameters<AgentHistoryHandle["timeline"]["refetch"]>[0]>["cursor"];
import type { OutlineRow } from "./conversation-outline";

interface History {
  rows: OutlineRow[];
  epoch: string;
  cursor: HistoryCursor;
  older: boolean;
}
const empty = (): History => ({ rows: [], epoch: "", cursor: undefined, older: false });


/** Canonical agent history shared by the outline and plan comparison picker. */
export function useConversationHistory(agentId: string) {
  const paseo = usePaseo();
  const handle = useMemo(() => paseo.agents.ref(agentId), [paseo, agentId]);
  const [history, setHistory] = useState<History>(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const busy = useRef(false);
  const load = useCallback(async (cursor?: HistoryCursor) => {
    if (busy.current) return;
    busy.current = true;
    const ticket = generation.current;
    setLoading(true);
    setError("");
    try {
      const page = await handle.timeline.refetch({ direction: cursor ? "before" : "tail", cursor, limit: 100, projection: "canonical" });
      if (ticket !== generation.current) return;
      setHistory(previous => {
        const same = previous.epoch === page.epoch && !page.reset && !page.staleCursor;
        const rows = new Map((same ? previous.rows : []).map(row => [row.seqStart, row]));
        page.entries.forEach(row => rows.set(row.seqStart, row));
        const keepEarlier = same && !cursor && previous.cursor && page.startCursor && previous.cursor.seq < page.startCursor.seq;
        return { rows: [...rows.values()], epoch: page.epoch,
          cursor: keepEarlier ? previous.cursor : page.startCursor ?? undefined,
          older: keepEarlier ? previous.older : page.hasOlder };
      });
    } catch {
      if (ticket === generation.current) setError("History could not be loaded. Try Refresh.");
    } finally {
      if (ticket === generation.current) { busy.current = false; setLoading(false); }
    }
  }, [handle]);
  useEffect(() => {
    generation.current++;
    busy.current = false;
    setHistory(empty());
    void load();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = handle.timeline.subscribe(() => {
      if (!timer) timer = setTimeout(() => { timer = undefined; void load(); }, 600);
    });
    subscription.ready.catch(() => { /* Manual refresh remains available offline. */ });
    return () => { generation.current++; clearTimeout(timer); subscription(); };
  }, [load, handle]);
  return { history, loading, error, load };
}
