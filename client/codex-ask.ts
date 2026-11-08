import { useEffect, useSyncExternalStore } from "react";
import { usePaseo, type PluginClientContext } from "@getpaseo/plugin/client";
import { answerCodexQuestions, isAskReply, pairAskTranscripts, parseAskQuestions } from "./ask-question";
import type { AgentPermissionRequest } from "@getpaseo/protocol/agent-types";
import type { AskQuestionData } from "../shared/contracts";
import { questionArchiveSchema, questionSettingsRpc } from "../shared/question-settings";

// Live SDK permissions retain the options that timeline history flattens away.
// Definitions are shared through daemon settings; answers stay in the timeline.
const captured = new Map<string, AskQuestionData[]>();
type ArchiveSession = {
  rpc: PluginClientContext["rpc"];
  active: boolean;
  pending: Map<string, AskQuestionData[]>;
  running: Promise<void> | null;
};
let archive: ArchiveSession | null = null;

export function refreshQuestionArchive(): Promise<void> {
  const session = archive;
  if (!session) return Promise.resolve();
  if (session.running) return session.running;
  session.running = (async () => {
    let conflicts = 0;
    do {
      const stored = await session.rpc(questionSettingsRpc.read, {});
      if (!session.active) return;
      if (stored.status !== "ready") throw new Error("Question archive is unavailable");
      const values = questionArchiveSchema.parse(stored.values);
      let restored = false;
      for (const [key, questions] of Object.entries(values.calls)) {
        if (!captured.has(key)) { captured.set(key, questions); restored = true; }
      }
      if (restored) changed();
      if (!session.pending.size) return;
      const saving = new Map(session.pending);
      const result = await session.rpc(questionSettingsRpc.write, {
        revision: stored.revision,
        values: JSON.parse(JSON.stringify({ calls: { ...values.calls, ...Object.fromEntries(saving) } })),
      });
      if (!session.active) return;
      if (result.status === "conflict" && ++conflicts < 3) continue;
      if (result.status !== "saved") throw new Error("Question archive could not be saved");
      conflicts = 0;
      for (const [key, questions] of saving) {
        if (session.pending.get(key) === questions) session.pending.delete(key);
      }
    } while (session.pending.size);
  })().catch(error => {
    // Preserve pending definitions for a retry on the next capture or card mount.
    console.warn("Refined Chat: question archive", error);
  }).finally(() => { session.running = null; });
  return session.running;
}

export function attachQuestionArchive(rpc: PluginClientContext["rpc"]): () => void {
  const session: ArchiveSession = { rpc, active: true, pending: new Map(captured), running: null };
  archive = session;
  void refreshQuestionArchive();
  return () => {
    session.active = false;
    if (archive === session) archive = null;
  };
}

export function captureCodexQuestions(agentId: string, requests: readonly AgentPermissionRequest[]): void {
  let updated = false;
  for (const request of requests) {
    if (request.provider !== "codex" || request.name !== "request_user_input_async"
      || !request.id.startsWith("permission-") || !request.input) continue;
    const key = `${agentId}:${request.id.slice("permission-".length)}`;
    if (captured.has(key)) continue;
    const questions = parseAskQuestions(request.input);
    if (!questions.length) continue;
    captured.set(key, questions);
    archive?.pending.set(key, questions);
    updated = true;
  }
  if (updated) changed();
  if (updated || archive?.pending.size) void refreshQuestionArchive();
}

// The host emits the request and its answer as separate rows with one callId.
// Keep their text while any row is mounted, including across virtualized rows.
const calls = new Map<string, { text: Map<number, string>; mounted: Map<number, number> }>();
// Transformers see these rows even when a collapsed run removes their renderers.
const projected = new Map<string, Set<string>>();
const hiddenReplies = new Map<string, { agentId: string; callId: string; text: string }>();
let projectionNoticeQueued = false;

export function noteCodexAskProjection(callId: string | undefined, name: string, detail: unknown): void {
  if (!callId || name.toLowerCase() !== "request_user_input_async"
    || !detail || typeof detail !== "object") return;
  const record = detail as Record<string, unknown>;
  if (record.type !== "plain_text" || typeof record.text !== "string" || !record.text.trim()) return;
  let texts = projected.get(callId);
  if (!texts) { texts = new Set(); projected.set(callId, texts); }
  if (texts.has(record.text)) return;
  texts.add(record.text);
  // Projection can run while React renders the host timeline.
  if (!projectionNoticeQueued) {
    projectionNoticeQueued = true;
    queueMicrotask(() => { projectionNoticeQueued = false; changed(); });
  }
}

function matchingCall(agentId: string, message: string): string | undefined {
  for (const [callId, texts] of projected) {
    const key = `${agentId}:${callId}`;
    // Capture or a mounted card proves which conversation owns the tool call.
    if (!captured.has(key) && !calls.has(key)) continue;
    if ([...texts].some(text => isAskReply(message, text))) return callId;
  }
  return undefined;
}
const listeners = new Set<() => void>();
let revision = 0;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = () => revision;
export const onCodexAskChange = subscribe;

export function isHiddenCodexReply(messageId: string | undefined, text: string): boolean {
  if (!messageId) return false;
  const reply = hiddenReplies.get(messageId);
  return reply?.text === text && matchingCall(reply.agentId, text) === reply.callId;
}

export function noteCodexAskReply(agentId: string, messageId: string | undefined, message: string): void {
  if (!messageId) return;
  const callId = matchingCall(agentId, message);
  if (!callId || hiddenReplies.get(messageId)?.text === message) return;
  hiddenReplies.set(messageId, { agentId, callId, text: message });
  changed();
}
function changed() {
  revision++;
  listeners.forEach(listener => listener());
}

export function useIsCodexAskReply(agentId: string, message: string): boolean {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return matchingCall(agentId, message) !== undefined;
}

export function useCodexAsk(agentId: string, callId: string | undefined, at: number, text: string | undefined) {
  const key = callId && text ? `${agentId}:${callId}` : undefined;
  const paseo = usePaseo();
  useEffect(() => {
    if (!key) return;
    void refreshQuestionArchive();
    let active = true;
    const handle = paseo.agents.ref(agentId);
    const stop = handle.subscribe(update => {
      if (update.kind === "upsert") captureCodexQuestions(agentId, update.agent.pendingPermissions);
    });
    // Local subscriptions do not replay the pending request. Fetch it when the
    // card mounts, including when a question was emitted before this listener.
    handle.refresh().then(result => {
      if (active && result) captureCodexQuestions(agentId, result.agent.pendingPermissions);
    }).catch(() => { /* Keep the timeline fallback if the snapshot is unavailable. */ });
    return () => { active = false; stop(); };
  }, [paseo, agentId, key]);
  useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (!key || !text) return;
    let call = calls.get(key);
    if (!call) {
      call = { text: new Map(), mounted: new Map() };
      calls.set(key, call);
    }
    call.text.set(at, text);
    call.mounted.set(at, (call.mounted.get(at) ?? 0) + 1);
    changed();
    return () => {
      const count = (call.mounted.get(at) ?? 1) - 1;
      if (count) call.mounted.set(at, count);
      else call.mounted.delete(at);
      if (!call.mounted.size) calls.delete(key);
      changed();
    };
  }, [key, at, text]);
  const call = key ? calls.get(key) : undefined;
  if (!call) return { hidden: false, questions: [], transcript: text };
  const times = [...call.text.keys()].sort((a, b) => a - b);
  const first = call.text.get(times[0]!)!;
  const last = call.text.get(times[times.length - 1]!)!;
  const questions = key ? captured.get(key) : undefined;
  return {
    hidden: at !== Math.min(...call.mounted.keys()),
    questions: questions ? answerCodexQuestions(questions, last) :
      times.length > 1 ? pairAskTranscripts(first, last) : [],
    transcript: last,
  };
}
