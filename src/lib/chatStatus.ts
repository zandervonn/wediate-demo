import type { Directive, SessionState } from "./types";

export interface BotStatusDraftMessage {
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}

export interface BotStatusChipState {
  label: string;
  // Reserved for trace/backward-compatible callers. The production chip no
  // longer renders a visible countdown.
  countdownSeconds?: number;
  tone: "active" | "waiting" | "complete";
}

export type BotStatusChipReason =
  | "session.completed"
  | "session.inactive"
  | "connection.poll_stale"
  | "generation.streaming"
  | "generation.bot_busy"
  | "generation.reply_pending"
  | "turn.all_parties_waiting"
  | "turn.other_party_waiting_flag"
  | "turn.user_response_due"
  | "turn.other_party_stale"
  | "backend.pending_directives"
  | "backend.mediator_running"
  | "backend.mediator_waiting"
  | "system.liveness_blocked"
  | "recovery.unresolved_idle"
  | "idle.no_chip";

export interface BotStatusChipInputs {
  pollStale: boolean;
  assistantDraftStreaming: boolean;
  assistantDraftHasText: boolean;
  self: {
    id: string | null;
    is_waiting: boolean;
    bot_busy: boolean;
    last_message_at: string | null;
  };
  others: Array<{
    id: string;
    is_waiting: boolean;
    bot_busy: boolean;
    last_message_at: string | null;
  }>;
  latestBotAt: string | null;
  latestVisibleAskAt: string | null;
  latestUserAt: string | null;
  waitingOnOthers: boolean;
  mediatorTimer: {
    status: "idle" | "waiting" | "running";
    seconds_remaining: number;
  } | null;
  pendingDirectives: {
    total: number;
    nonBot: number;
    byType: Record<string, number>;
    actionExpected: Record<string, number>;
  };
  hasOpenVisibleAsk: boolean;
  livenessBlocker: string | null;
}

export interface BotStatusChipExplanation {
  status: BotStatusChipState | null;
  reason: BotStatusChipReason;
  inputs: BotStatusChipInputs;
}

// Polls run every 4s; treat ~2.5 missed polls as a real stall.
export const POLL_STALE_MS = 10000;

export interface PollStaleInput {
  lastStateRefreshAt: number | null;
  now: number;
  sending: boolean;
  documentHidden: boolean;
}

// Connection liveness (render-time): no successful state poll in POLL_STALE_MS,
// and we're not mid-send and the tab is visible. Extracted as a pure function so
// the 10s flip is unit-testable on a simulated clock rather than only in a
// browser. Feeds buildBotStatusChip via options.pollStale.
export function isPollStale({ lastStateRefreshAt, now, sending, documentHidden }: PollStaleInput): boolean {
  if (sending || documentHidden) return false;
  if (lastStateRefreshAt === null) return false;
  return now - lastStateRefreshAt > POLL_STALE_MS;
}

const RECONNECTING_CHIP: BotStatusChipState = { label: "Reconnecting...", tone: "waiting" };

export function parseTime(value: string | null | undefined) {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
}

function asksForUserResponse(text: string | null | undefined): boolean {
  return Boolean((text || "").includes("?"));
}

export interface BotStatusOptions {
  // True when state polls have stalled. Surfaces the reconnecting state at the
  // top of the ladder so the chip's liveness pulse can't falsely reassure while
  // the app/network is wedged.
  pollStale?: boolean;
}

function summarizePendingDirectives(state: SessionState): BotStatusChipInputs["pendingDirectives"] {
  const summary: BotStatusChipInputs["pendingDirectives"] = {
    total: state.pending_directives.length,
    nonBot: 0,
    byType: {},
    actionExpected: {},
  };
  for (const directive of state.pending_directives) {
    summary.byType[directive.directive_type] = (summary.byType[directive.directive_type] || 0) + 1;
    if (directive.directive_type !== "BOT_RESPONSE") summary.nonBot += 1;
    const action = directive.action_expected || "none";
    summary.actionExpected[action] = (summary.actionExpected[action] || 0) + 1;
  }
  return summary;
}

// Single source of truth for the chat status chip. The chip answers four
// independent questions and must show exactly one of them, in this priority:
//
//   1. Connection - are we still receiving state?       (reconnecting...)
//   2. Generation - is your bot producing output now?   (replying/thinking)
//   3. Turn       - whose move is it: you/other/nobody? (waiting for your reply /
//                                                        waiting on the other side)
//   4. Backend    - is the mediator coordinating?       (thinking...)
//
// explainBotStatusChip returns the rendered status plus the reason and inputs
// that produced it. buildBotStatusChip preserves the old render-only API.
export function explainBotStatusChip(
  state: SessionState,
  draftMessages: BotStatusDraftMessage[],
  options: BotStatusOptions = {},
): BotStatusChipExplanation {
  const self = state.participants.find((participant) => participant.id === state.participant_id);
  const others = state.participants.filter((participant) => participant.id !== state.participant_id);
  const assistantDraft = draftMessages.find((message) => message.role === "assistant");
  const botResponses = state.my_directives.filter((directive) => directive.directive_type === "BOT_RESPONSE");
  const latestBot = botResponses.reduce<Directive | null>((latest, directive) => {
    if (!latest) return directive;
    return parseTime(directive.created_at) >= parseTime(latest.created_at) ? directive : latest;
  }, null);
  const latestBotTs = parseTime(latestBot?.created_at);
  const latestVisibleAsk = botResponses.reduce<Directive | null>((latest, directive) => {
    if (!asksForUserResponse(directive.content)) return latest;
    if (!latest) return directive;
    return parseTime(directive.created_at) >= parseTime(latest.created_at) ? directive : latest;
  }, null);
  const latestVisibleAskTs = parseTime(latestVisibleAsk?.created_at);
  const latestUserTs = Math.max(
    0,
    ...state.my_entries
      .filter((entry) => entry.entry_type === "USER_MESSAGE")
      .map((entry) => parseTime(entry.created_at)),
  );
  const hasOpenVisibleAsk = latestVisibleAskTs > 0 && latestVisibleAskTs > latestUserTs && !self?.is_waiting;
  const waitingOnOthers = latestBotTs
    ? others.some((participant) => parseTime(participant.last_message_at) < latestUserTs)
    : false;
  const hasUnresolvedWork =
    state.artifact.unresolved_topic_ids.length > 0
    || state.topics.some((topic) => topic.state !== "RESOLVED");
  const timer = state.mediator_timer;
  const pendingDirectives = summarizePendingDirectives(state);
  const inputs: BotStatusChipInputs = {
    pollStale: Boolean(options.pollStale),
    assistantDraftStreaming: Boolean(assistantDraft?.streaming),
    assistantDraftHasText: Boolean(assistantDraft?.text),
    self: {
      id: self?.id || null,
      is_waiting: Boolean(self?.is_waiting),
      bot_busy: Boolean(self?.bot_busy),
      last_message_at: self?.last_message_at || null,
    },
    others: others.map((participant) => ({
      id: participant.id,
      is_waiting: Boolean(participant.is_waiting),
      bot_busy: Boolean(participant.bot_busy),
      last_message_at: participant.last_message_at || null,
    })),
    latestBotAt: latestBotTs ? new Date(latestBotTs).toISOString() : null,
    latestVisibleAskAt: latestVisibleAskTs ? new Date(latestVisibleAskTs).toISOString() : null,
    latestUserAt: latestUserTs ? new Date(latestUserTs).toISOString() : null,
    waitingOnOthers,
    mediatorTimer: timer ? { status: timer.status, seconds_remaining: timer.seconds_remaining } : null,
    pendingDirectives,
    hasOpenVisibleAsk,
    livenessBlocker: state.liveness_blocker || null,
  };
  const done = (status: BotStatusChipState | null, reason: BotStatusChipReason): BotStatusChipExplanation => ({
    status,
    reason,
    inputs,
  });

  if (state.status === "COMPLETED") return done({ label: "Complete", tone: "complete" }, "session.completed");
  if (state.status !== "ACTIVE") return done(null, "session.inactive");

  // 1. Connection outranks every content state: if we can't trust the state
  // we're holding, don't assert anything about it.
  if (options.pollStale) return done(RECONNECTING_CHIP, "connection.poll_stale");

  // 2. Generation: "Replying" is reserved for visible assistant text.
  // Empty draft streaming / bot_busy / reply-pending means the model or
  // backend is still working, but no user-visible tokens are being output.
  if (assistantDraft?.streaming && assistantDraft.text) {
    return done({ label: "Replying...", tone: "active" }, "generation.streaming");
  }
  if (assistantDraft?.streaming) {
    return done({ label: "Thinking...", tone: "active" }, "generation.streaming");
  }
  if (self?.bot_busy) return done({ label: "Thinking...", tone: "active" }, "generation.bot_busy");
  if (latestUserTs > latestBotTs) return done({ label: "Thinking...", tone: "active" }, "generation.reply_pending");
  if (pendingDirectives.nonBot > 0) {
    return done({ label: "Mediator queued", tone: "waiting" }, "backend.pending_directives");
  }

  const otherPartyLabel =
    others.length > 1 ? "Waiting on other participants" : "Waiting on the other side";

  // 3. Turn. is_waiting means the bot has done its part and expects a
  // cross-party update. It is the other party's turn, and that outranks the
  // "a bot message is newer than your last reply" heuristic below.
  if (self?.is_waiting && others.length > 0 && others.every((participant) => participant.is_waiting)) {
    return done({ label: "Waiting for mediator", tone: "waiting" }, "turn.all_parties_waiting");
  }
  if (self?.is_waiting) return done({ label: otherPartyLabel, tone: "waiting" }, "turn.other_party_waiting_flag");

  if (latestBotTs) {
    // A visible bot question keeps the ball in your court until a newer user
    // message answers it. Later non-question handoffs do not create a user turn,
    // but they also do not erase an earlier unresolved visible ask.
    if (hasOpenVisibleAsk) {
      return done({ label: "Waiting for your reply", tone: "waiting" }, "turn.user_response_due");
    }
    // You replied after the bot, or the latest bot message was a non-question
    // handoff; if another party hasn't caught up, it's theirs.
    if (waitingOnOthers) return done({ label: otherPartyLabel, tone: "waiting" }, "turn.other_party_stale");
  }

  // 4. Backend: nobody owes a turn; surface mediator coordination as its
  // own state. Countdown only while the debounce timer is counting down.
  if (timer?.status === "running") {
    return done({ label: "Mediator reviewing...", tone: "active" }, "backend.mediator_running");
  }
  if (timer?.status === "waiting") {
    return done(
      {
        label: "Mediator queued",
        tone: "waiting",
      },
      "backend.mediator_waiting",
    );
  }

  if (hasUnresolvedWork) {
    return done({ label: "Waiting for mediator", tone: "waiting" }, "recovery.unresolved_idle");
  }

  return done(null, "idle.no_chip");
}

export function buildBotStatusChip(
  state: SessionState,
  draftMessages: BotStatusDraftMessage[],
  options: BotStatusOptions = {},
): BotStatusChipState | null {
  return explainBotStatusChip(state, draftMessages, options).status;
}
