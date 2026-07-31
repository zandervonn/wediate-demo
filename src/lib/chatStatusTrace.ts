import type { BotStatusChipExplanation } from "./chatStatus";

const STORAGE_PREFIX = "wediate.chatStatusTrace:";
const MAX_INTERVALS = 1000;

export interface ChatStatusTraceInterval {
  startAt: string;
  endAt: string | null;
  durationMs: number | null;
  sessionId: string;
  participantId: string;
  label: string;
  tone: string | null;
  countdownSeconds: number | null;
  reason: string;
  inputs: BotStatusChipExplanation["inputs"];
}

export interface ChatStatusTrace {
  version: 1;
  sessionId: string;
  participantId: string;
  updatedAt: string;
  intervals: ChatStatusTraceInterval[];
}

declare global {
  interface Window {
    __wediateChatStatusTraces?: Record<string, ChatStatusTrace>;
    __wediateGetChatStatusTrace?: (sessionId?: string, participantId?: string) => ChatStatusTrace | Record<string, ChatStatusTrace> | null;
    __wediateClearChatStatusTrace?: (sessionId?: string, participantId?: string) => void;
  }
}

function traceKey(sessionId: string, participantId: string) {
  return `${sessionId}:${participantId}`;
}

function storageKey(sessionId: string, participantId: string) {
  return `${STORAGE_PREFIX}${traceKey(sessionId, participantId)}`;
}

function nowIso(nowMs: number) {
  return new Date(nowMs).toISOString();
}

function signatureFor(explanation: BotStatusChipExplanation) {
  return JSON.stringify({
    label: explanation.status?.label || "",
    tone: explanation.status?.tone || null,
    countdownSeconds: explanation.status?.countdownSeconds ?? null,
    reason: explanation.reason,
    inputs: explanation.inputs,
  });
}

function readStoredTrace(sessionId: string, participantId: string): ChatStatusTrace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId, participantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatStatusTrace;
    if (parsed.sessionId !== sessionId || parsed.participantId !== participantId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredTrace(trace: ChatStatusTrace) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(trace.sessionId, trace.participantId), JSON.stringify(trace));
  } catch {
    // Best-effort telemetry only. The in-memory window handle still works.
  }
}

function installTraceGlobals() {
  if (typeof window === "undefined") return;
  window.__wediateChatStatusTraces ||= {};
  window.__wediateGetChatStatusTrace ||= (sessionId?: string, participantId?: string) => {
    const traces = window.__wediateChatStatusTraces || {};
    if (sessionId && participantId) {
      return traces[traceKey(sessionId, participantId)] || readStoredTrace(sessionId, participantId);
    }
    return traces;
  };
  window.__wediateClearChatStatusTrace ||= (sessionId?: string, participantId?: string) => {
    if (!window.__wediateChatStatusTraces) return;
    if (sessionId && participantId) {
      delete window.__wediateChatStatusTraces[traceKey(sessionId, participantId)];
      try {
        window.localStorage.removeItem(storageKey(sessionId, participantId));
      } catch {
        // Ignore storage failures in debug-only cleanup.
      }
      return;
    }
    window.__wediateChatStatusTraces = {};
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith(STORAGE_PREFIX)) window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage failures in debug-only cleanup.
    }
  };
}

export function getChatStatusTrace(sessionId: string, participantId: string): ChatStatusTrace | null {
  if (typeof window === "undefined") return null;
  installTraceGlobals();
  return window.__wediateChatStatusTraces?.[traceKey(sessionId, participantId)] || readStoredTrace(sessionId, participantId);
}

export function recordChatStatusTrace(
  sessionId: string,
  participantId: string,
  explanation: BotStatusChipExplanation,
  nowMs = Date.now(),
): ChatStatusTrace | null {
  if (typeof window === "undefined") return null;
  installTraceGlobals();
  const key = traceKey(sessionId, participantId);
  const traces = window.__wediateChatStatusTraces || {};
  let trace = traces[key] || readStoredTrace(sessionId, participantId);
  if (!trace) {
    trace = { version: 1, sessionId, participantId, updatedAt: nowIso(nowMs), intervals: [] };
  }

  const nextSignature = signatureFor(explanation);
  const last = trace.intervals[trace.intervals.length - 1];
  const lastRecordedMs = Date.parse(trace.updatedAt);
  const recordingGap = Number.isFinite(lastRecordedMs) && nowMs - lastRecordedMs > 15000;
  const lastSignature = last
    ? JSON.stringify({
        label: last.label,
        tone: last.tone,
        countdownSeconds: last.countdownSeconds,
        reason: last.reason,
        inputs: last.inputs,
      })
    : null;

  if (last && lastSignature === nextSignature && !recordingGap) {
    last.endAt = nowIso(nowMs);
    last.durationMs = Date.parse(last.endAt) - Date.parse(last.startAt);
  } else {
    const startAt = nowIso(nowMs);
    if (last && last.endAt === null) {
      last.endAt = recordingGap ? trace.updatedAt : startAt;
      last.durationMs = Date.parse(last.endAt) - Date.parse(last.startAt);
    }
    trace.intervals.push({
      startAt,
      endAt: null,
      durationMs: null,
      sessionId,
      participantId,
      label: explanation.status?.label || "",
      tone: explanation.status?.tone || null,
      countdownSeconds: explanation.status?.countdownSeconds ?? null,
      reason: explanation.reason,
      inputs: explanation.inputs,
    });
    if (trace.intervals.length > MAX_INTERVALS) {
      trace.intervals = trace.intervals.slice(trace.intervals.length - MAX_INTERVALS);
    }
  }

  trace.updatedAt = nowIso(nowMs);
  traces[key] = trace;
  window.__wediateChatStatusTraces = traces;
  writeStoredTrace(trace);
  return trace;
}
