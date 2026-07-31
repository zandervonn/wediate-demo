import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { api } from "../lib/api";
import { explainBotStatusChip, isPollStale, parseTime, type BotStatusChipState } from "../lib/chatStatus";
import { getChatStatusTrace, recordChatStatusTrace } from "../lib/chatStatusTrace";
import { renderMarkdown, renderMarkdownWithHighlights } from "../lib/markdown";
import type {
  ArtifactSection,
  MediatorTimerState,
  Participant,
  ProtectedDisplayGroup,
  ProtectedItem,
  RedactionHighlightSpan,
  RedactionMessageProtection,
  MediationPhase,
  SessionState,
  TopicView,
} from "../lib/types";
import { buildSharedOutcomeUrl, useAppStore } from "../store";
import { Tooltip } from "./Tooltip";

const MEDIATOR_INTERVAL_SECONDS = 30;

function MediatorProgressBar({ timer }: { timer: MediatorTimerState }) {
  // Debug-only two-segment progress bar showing the cycle scheduler state.
  // Left segment fills as the debounce window counts down; right segment
  // animates while the cycle runs. Idle = empty.
  const debouncePct = timer.status === "waiting"
    ? Math.max(
        0,
        Math.min(
          100,
          ((MEDIATOR_INTERVAL_SECONDS - timer.seconds_remaining) / MEDIATOR_INTERVAL_SECONDS) * 100,
        ),
      )
    : timer.status === "running" ? 100 : 0;
  const runningClass = timer.status === "running" ? "running" : "";
  return (
    <div className={`orch-progress ${runningClass}`} title={`${timer.status}${timer.status === "waiting" ? ` (${timer.seconds_remaining}s)` : ""}`}>
      <div className="orch-progress-debounce" style={{ width: `${debouncePct}%` }} />
      {timer.status === "running" ? <div className="orch-progress-running" /> : null}
    </div>
  );
}

const PHASE_STEPS: Array<{ phase: MediationPhase; label: string }> = [
  { phase: "MAPPING", label: "Collect" },
  { phase: "CONVERGENCE", label: "Converge" },
  { phase: "SYNTHESIS", label: "Finalize" },
];

function PhaseRail({
  state,
  suggesting,
  onSuggestAdvance,
}: {
  state: SessionState;
  suggesting: boolean;
  onSuggestAdvance: () => void;
}) {
  const current = state.mediation_phase || "MAPPING";
  const currentIndex = PHASE_STEPS.findIndex((step) => step.phase === current);
  const next = currentIndex >= 0 ? PHASE_STEPS[currentIndex + 1] : null;
  const suggestedByMe = state.phase_suggestions?.some(
    (suggestion) =>
      suggestion.participant_id === state.participant_id
      && suggestion.from_phase === current,
  ) ?? false;
  return (
    <div className="phase-rail" aria-label="Mediation phase">
      <div className="phase-steps">
        {PHASE_STEPS.map((step, index) => {
          const sessionComplete = state.status === "COMPLETED";
          const active = !sessionComplete && step.phase === current;
          const complete = sessionComplete || currentIndex > index;
          const pendingTarget = suggestedByMe && step.phase === next?.phase;
          return (
            <span
              key={step.phase}
              className={`phase-step${active ? " active" : ""}${complete ? " complete" : ""}${pendingTarget ? " pending-target" : ""}`}
              aria-current={active ? "step" : undefined}
            >
              {step.label}
            </span>
          );
        })}
      </div>
      {next ? (
        <button
          type="button"
          className={`phase-advance${suggestedByMe ? " suggested" : ""}`}
          onClick={onSuggestAdvance}
          disabled={suggesting || suggestedByMe}
          title={suggestedByMe ? `Mediator will consider ${next.label} next` : `Ask mediator to consider ${next.label}`}
          aria-label={suggestedByMe ? `Pending move to ${next.label}` : `Ask mediator to consider ${next.label}`}
        >
          <span className="phase-advance-icon" aria-hidden="true">&gt;&gt;</span>
          <span>{suggestedByMe ? "Sent" : "Next phase"}</span>
        </button>
      ) : null}
    </div>
  );
}

function fmtInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function fmtTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shouldDirectSavePdfForDevReview() {
  return import.meta.env.DEV && navigator.webdriver === true;
}

async function downloadArtifactPdf(sessionId: string, participantId: string) {
  if (shouldDirectSavePdfForDevReview()) {
    try {
      const saved = await api.saveArtifactPdfForDevReview(sessionId, participantId);
      console.info(`Saved PDF for dev review: ${saved.path}`);
      return;
    } catch (err) {
      console.warn("Direct dev PDF save failed; falling back to browser download.", err);
    }
  }
  const link = document.createElement("a");
  link.href = api.artifactPdfUrl(sessionId, participantId);
  link.download = "";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function downloadArtifact(state: SessionState) {
  await downloadArtifactPdf(state.session_id, state.participant_id);
}

function openProtectedItemsPanel() {
  const section = document.querySelector<HTMLElement>(".protection-section");
  const head = document.querySelector<HTMLButtonElement>(".protection-section-head");
  if (!section || !head) return;
  if (!section.classList.contains("open")) head.click();
  section.scrollIntoView({ block: "nearest", behavior: "smooth" });
  head.focus({ preventScroll: true });
}

const ChatMessage = memo(function ChatMessage({
  role,
  text,
  ts,
  error,
  spans,
  protection,
  onOpenProtection,
  provenanceLabel,
  replyTitle,
}: {
  role: "user" | "assistant";
  text: string;
  ts: string;
  error?: boolean;
  spans?: RedactionHighlightSpan[];
  protection?: RedactionMessageProtection;
  onOpenProtection?: () => void;
  provenanceLabel?: string;
  replyTitle?: string;
}) {
  // Inline redaction highlights only apply to the participant's own messages
  // (the redacted values are their own). Bot replies render plain.
  const html =
    role === "user" && spans && spans.length > 0
      ? renderMarkdownWithHighlights(text, spans)
      : renderMarkdown(text);
  return (
    <div className={`chat-row ${role === "user" ? "user" : "assistant"}`}>
      <div className={`chat-bubble ${role === "user" ? "user" : "assistant"} ${error ? "error" : ""}`}>
        {provenanceLabel ? <div className="chat-provenance">{provenanceLabel}</div> : null}
        {replyTitle ? <div className="chat-reply-context">Reply to {replyTitle}</div> : null}
        <div className="chat-text" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="chat-meta">
          <span>{fmtTime(ts)}</span>
          {role === "user" && protection ? (
            <Tooltip align="end" content={
                protection.authorized
                  ? "Private terms from this message have been shared."
                  : "Private terms were held from this message. Open Private terms to manage them."
              }>
              <button
                type="button"
                className={`chat-protection-lock${protection.authorized ? " shared" : ""}`}
                onClick={onOpenProtection}
                aria-label="Open Private terms for this message"
              >
                <svg
                  width="10"
                  height="11"
                  viewBox="0 0 10 11"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2" y="5" width="6" height="5" rx="0.8" />
                  <path d="M3.3 5V3.4a1.7 1.7 0 0 1 3.4 0V5" />
                </svg>
                <span>{protection.cluster_ids.length}</span>
              </button>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </div>
  );
});

interface ChatItem {
  id: string;
  renderKey: string;
  role: "user" | "assistant";
  text: string;
  ts: string;
  streaming?: boolean;
  error?: boolean;
  serverSurfaceId?: string;
  provenanceLabel?: string;
  replyTitle?: string;
}

type DraftChatItem = Omit<ChatItem, "renderKey"> & { renderKey?: string };

function normalizedMessageText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function matchesOptimisticDraft(server: ChatItem, draft: ChatItem) {
  if (server.role !== draft.role) return false;
  if (draft.serverSurfaceId) return server.id === draft.serverSurfaceId;
  if (normalizedMessageText(server.text) !== normalizedMessageText(draft.text)) return false;
  const serverTs = parseTime(server.ts);
  const draftTs = parseTime(draft.ts);
  if (!serverTs || !draftTs) return false;
  return serverTs >= draftTs - 2000 && serverTs - draftTs <= 10 * 60 * 1000;
}

export function buildCombinedMessages(state: SessionState, draftMessages: DraftChatItem[]) {
  const topicNameById = new Map(state.topics.map((topic) => [topic.id, displayTopicName(topic.name)]));
  const normalizedDrafts: ChatItem[] = draftMessages.map((message) => ({
    ...message,
    renderKey: message.renderKey || message.id,
  }));
  const committedChat = state.participant_view?.surfaces
    ?.filter((surface) => surface.surface_kind === "chat")
    .map((surface) => ({
      id: surface.id,
      renderKey: surface.id,
      role: surface.author_role === "user" ? "user" as const : "assistant" as const,
      text: surface.exact_text,
      ts: surface.committed_at,
      provenanceLabel: surface.source_type === "disclosure_grant"
        ? "Exact statement approved for sharing"
        : undefined,
      replyTitle: surface.reply_link_kind === "explicit" && surface.topic_ids.length > 0
        ? topicNameById.get(surface.topic_ids[0])
        : undefined,
    }));
  const legacyServerMessages: ChatItem[] = [
    ...state.my_entries
      .filter((entry) => entry.entry_type === "USER_MESSAGE")
      .map((entry) => ({
        id: entry.id,
        renderKey: entry.id,
        role: "user" as const,
        text: entry.content,
        ts: entry.created_at,
      })),
    ...state.my_directives
      .filter((directive) => directive.directive_type === "BOT_RESPONSE")
      .map((directive) => ({
        id: directive.id,
        renderKey: directive.id,
        role: "assistant" as const,
        text: directive.content,
        ts: directive.created_at,
      })),
  ];
  const serverMessages: ChatItem[] = committedChat?.length
    ? committedChat
    : legacyServerMessages;
  const visibleDrafts = normalizedDrafts.filter((draft) => {
    if (serverMessages.some((server) => matchesOptimisticDraft(server, draft))) return false;
    return draft.role !== "assistant" || draft.error || draft.text.trim().length > 0;
  });
  const serverWithStableKeys = serverMessages.map((server) => {
    const matchingDraft = normalizedDrafts.find((draft) => matchesOptimisticDraft(server, draft));
    return matchingDraft ? { ...server, renderKey: matchingDraft.renderKey || matchingDraft.id } : server;
  });
  return [...serverWithStableKeys, ...visibleDrafts].sort((a, b) => a.ts.localeCompare(b.ts));
}

function ChatStatusChip({ status }: { status: BotStatusChipState }) {
  return (
    <div className="chat-status-row">
      <div className={`chat-status-chip ${status.tone}`}>
        <span className="chat-status-dot" aria-hidden="true" />
        <span>{status.label}</span>
      </div>
    </div>
  );
}

interface ReplyTarget {
  id: string;
  title: string;
  text: string;
  surfaceId?: string;
  topicId?: string;
  frontierQuestionId?: string;
  sharedSnapshotId?: string;
  sharedSnapshotRevision?: number;
}

function displayTopicName(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "Untitled topic";
  return trimmed.replace(/^(\S)/, (first) => first.toLocaleUpperCase());
}

function ProtectionSection({
  sessionId,
  participantId,
  open,
  onOpenChange,
  onHeightChange,
}: {
  sessionId: string;
  participantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHeightChange: (height: number) => void;
}) {
  const [items, setItems] = useState<ProtectedItem[]>([]);
  const [displayGroups, setDisplayGroups] = useState<ProtectedDisplayGroup[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const resizeStart = useRef<{ railHeight: number; sectionHeight: number; y: number } | null>(null);

  // Disclosure v4: pending state lives in the store so it can ride along
  // with the next chat message and lock until the backend confirms.
  const pendingDisclosures = useAppStore((s) => s.pendingDisclosures);
  const togglePending = useAppStore((s) => s.togglePendingDisclosure);
  const clearPending = useAppStore((s) => s.clearPendingDisclosures);

  useEffect(() => {
    let cancelled = false;
    const fetchItems = async () => {
      try {
        const res = await api.getProtectedItems(sessionId, participantId);
        if (cancelled) return;
        setItems(res.items || []);
        setDisplayGroups(res.display_groups || []);
      } catch {
        // Soft-fail: section stays empty if the endpoint errors.
      }
    };
    void fetchItems();
    const id = window.setInterval(fetchItems, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId, participantId]);

  // Once the backend has authorized a staged item, drop it from the
  // pending map so the chicklet renders as locked-green naturally.
  useEffect(() => {
    const stuck = items
      .filter((i) => i.authorized && i.cluster_id in pendingDisclosures)
      .map((i) => i.cluster_id);
    if (stuck.length > 0) clearPending(stuck);
  }, [items, pendingDisclosures, clearPending]);

  const grantItem = useCallback(
    (item: ProtectedItem) => {
      if (item.authorized) return;
      togglePending(item.cluster_id, item.label);
    },
    [togglePending],
  );

  if (items.length === 0) return null;

  const itemsById = new Map(items.map((item) => [item.cluster_id, item]));
  const assigned = new Set<number>();
  const groups: Array<{
    key: string;
    label: string;
    members: ProtectedItem[];
  }> = displayGroups.flatMap((group) => {
    const members = group.cluster_ids
      .map((clusterId) => itemsById.get(clusterId))
      .filter((item): item is ProtectedItem => Boolean(item));
    members.forEach((item) => assigned.add(item.cluster_id));
    if (members.length === 0) return [];
    return [{
      key: group.id,
      label: group.label,
      members,
    }];
  });
  const orphans = items.filter((item) => !assigned.has(item.cluster_id));
  if (orphans.length > 0) {
    groups.push({ key: "uncategorized", label: "Other", members: orphans });
  }

  const totalCount = items.length;
  const sharedCount = items.filter((i) => i.authorized).length;
  const hasLockedPending = Object.values(pendingDisclosures).some((item) => item.locked);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!open || event.button !== 0) return;
    const section = event.currentTarget.closest<HTMLElement>(".protection-section");
    const rail = event.currentTarget.closest<HTMLElement>(".rail");
    if (!section || !rail) return;
    resizeStart.current = {
      railHeight: rail.getBoundingClientRect().height,
      sectionHeight: section.getBoundingClientRect().height,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const resize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = resizeStart.current;
    if (!start) return;
    onHeightChange(clampProtectionPanelHeight(
      start.sectionHeight + start.y - event.clientY,
      start.railHeight,
    ));
  };

  const endResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    resizeStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className={`protection-section ${open ? "open" : "closed"}`}>
      <div className="protection-section-toolbar">
        {open ? (
          <div
            className="protection-section-resize-handle"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize Private terms"
            onPointerDown={startResize}
            onPointerMove={resize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
          />
        ) : null}
        <button
          type="button"
          className="protection-section-head"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
        >
          <span className="protection-section-chevron">{open ? "\u25BC" : "\u25B6"}</span>
          <span className="protection-section-title">Private terms</span>
          <Tooltip
            align="end"
            content={
              <>
                <strong>Your private details</strong>
                <span>
                  Each row is held from the other side. Select one to share that
                  exact detail with your next message. Sharing cannot be undone.
                </span>
              </>
            }
          >
            <span
              className="app-tooltip-help"
              tabIndex={0}
              role="button"
              aria-label="How Private terms work"
              onClick={(event) => event.stopPropagation()}
            >
              ?
            </span>
          </Tooltip>
          <span className="protection-section-count">
            {sharedCount > 0 ? `${sharedCount}/${totalCount}` : totalCount}
          </span>
        </button>
      </div>
      {open && (
        <div className="protection-section-scroll">
          <div className="protection-section-groups">
            {totalCount > 0 && (
              <div className="protection-section-note protection-explainer">
                A lock on a chat message means that message produced Private
                terms. This panel is the complete place to see what is still held
                and what has been shared.
              </div>
            )}
            {hasLockedPending && (
              <div className="protection-section-note">
                Share update pending; this can take up to one mediator cycle.
              </div>
            )}
            {groups.map(({ key, label, members }) => {
            const isExpanded = expanded[key] ?? members.length <= 2;
            const allAuthorized = members.every((m) => m.authorized);
            return (
              <div
                key={key}
                className={`protection-group ${allAuthorized ? "all-shared" : ""}`}
              >
                <div className="protection-group-head">
                  <button
                    type="button"
                    className="protection-group-toggle"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [key]: !isExpanded }))
                    }
                    aria-expanded={isExpanded}
                  >
                    <span className="protection-group-chevron">
                      {isExpanded ? "▼" : "▶"}
                    </span>
                    <span className="protection-group-label">{label}</span>
                    <span className="protection-group-count">{members.length}</span>
                  </button>
                </div>
                {isExpanded && (
                  <div className="protection-group-list">
                    {members.map((item) => {
                      const pending = pendingDisclosures[item.cluster_id];
                      const isLocked = pending?.locked === true;
                      const isStaged = !!pending && !isLocked;
                      // Once authorized, the item is permanently shared —
                      // the other party may already have seen it. There's
                      // no take-back, so the chicklet is locked at green.
                      let stateClass: string;
                      let stateLabel: string;
                      if (isLocked) stateClass = "pending locked";
                      else if (isStaged) stateClass = "pending";
                      else if (item.authorized) stateClass = "shared";
                      else stateClass = "redacted";
                      if (isLocked) stateLabel = "Updating";
                      else if (isStaged) stateLabel = "Sharing";
                      else if (item.authorized) stateLabel = "Shared";
                      else stateLabel = "Held";

                      const onClick = () => {
                        if (isLocked || item.authorized) return;
                        grantItem(item);
                      };

                      return (
                        <button
                          type="button"
                          key={item.cluster_id}
                          data-testid={`private-term-${item.cluster_id}`}
                          className={`protection-chicklet ${stateClass}`}
                          disabled={isLocked || item.authorized}
                          onClick={onClick}
                          title={item.variants.join(" · ")}
                        >
                          <span className="protection-chicklet-copy">
                            <span className="protection-chicklet-label">{item.label}</span>
                            {item.source_texts?.length ? (
                              <span className="protection-chicklet-source">
                                Source: {item.source_texts.join(" · ")}
                              </span>
                            ) : null}
                          </span>
                          <span className="protection-chicklet-meta">
                            {item.count > 1 && (
                              <span className="protection-chicklet-count">{item.count}</span>
                            )}
                            <span className="protection-chicklet-state">{stateLabel}</span>
                            <span
                              className="protection-chicklet-lock"
                              aria-hidden="true"
                            >
                            {/* Two stacked padlock glyphs swapped by CSS:
                                 - red default: closed | hover: open (preview unlock)
                                 - yellow staged default: open | hover: closed (preview re-lock)
                                 - yellow locked: open (committed, waiting backend)
                                 - green: open (permanent) */}
                            <svg
                              className="lock-glyph lock-closed"
                              width="10"
                              height="11"
                              viewBox="0 0 10 11"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="2" y="5" width="6" height="5" rx="0.8" />
                              <path d="M3.3 5V3.4a1.7 1.7 0 0 1 3.4 0V5" />
                            </svg>
                            <svg
                              className="lock-glyph lock-open"
                              width="10"
                              height="11"
                              viewBox="0 0 10 11"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="2" y="5" width="6" height="5" rx="0.8" />
                              <path d="M3.3 5V3.4a1.7 1.7 0 0 1 3.4 0" />
                            </svg>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function hasPackageSurface(topic: TopicView): boolean {
  return Boolean(
    topic.workbench || topic.shared_snapshot
    ||
    topic.proposal_group_id
    || topic.proposal_snapshot_hash
    || (topic.proposal_summary || "").trim(),
  );
}

function acceptanceLabel(topic: TopicView, state: SessionState): string | null {
  if (!isWorkingAgreementTopic(topic)) return null;
  return agreementAcceptanceLabel([topic], state);
}

function agreementAcceptanceLabel(topics: TopicView[], state: SessionState): string | null {
  if (!topics.every(isWorkingAgreementTopic)) return null;
  const snapshotHash = commonPackageSnapshotHash(topics);
  const canonical = topics.length === 1
    ? (topics[0].workbench || topics[0].shared_snapshot)
    : null;
  if (
    !canonical
    &&
    snapshotHash
    && state.participants.some((participant) =>
      topics.some((topic) => (topic.visible_snapshot_hashes || {})[participant.id] !== snapshotHash),
    )
  ) {
    return "Revision being prepared";
  }
  const waiting = state.participants
    .filter((participant) =>
      !packageAcceptedByParticipant(topics, participant.id, snapshotHash),
    )
    .map((participant) => participant.display_name);
  if (waiting.length === 0) return "Agreed by all";
  if (waiting.length === 1) return `Waiting on ${waiting[0]}`;
  return `Waiting on ${waiting.length}`;
}

function hasConfirmablePackage(topic: TopicView): boolean {
  return Boolean(
    (topic.workbench?.id && topic.workbench.revision)
    || (topic.shared_snapshot?.id && topic.shared_snapshot.revision)
    || (topic.proposal_group_id && topic.proposal_snapshot_hash),
  );
}

export function clampProtectionPanelHeight(proposedHeight: number, railHeight: number): number {
  const minimumHeight = 152;
  const maximumHeight = Math.max(minimumHeight, railHeight - 152);
  return Math.min(Math.max(proposedHeight, minimumHeight), maximumHeight);
}

export interface WorkbenchChangeBinding {
  proposalSnapshotHash?: string;
  proposalGroupId?: string | null;
  workbenchId?: string;
  workbenchRevision?: number;
  workbenchBindings?: Array<{
    topicId: string;
    workbenchId: string;
    workbenchRevision: number;
  }>;
}

/**
 * Bind a grouped package to every exact canonical topic workbench rendered in
 * the chip. The shared proposal hash remains a compatibility checksum, not a
 * second acceptance authority.
 */
export function workbenchChangeBinding(topics: TopicView[]): WorkbenchChangeBinding {
  const first = topics[0];
  if (!first) return {};
  const snapshotHash = commonPackageSnapshotHash(topics) || undefined;
  const canonical = topics.length === 1
    ? (first.workbench || first.shared_snapshot)
    : null;
  const hasCompleteGroupedBinding = topics.length > 1 && topics.every(
    (topic) => Boolean(topic.workbench || topic.shared_snapshot),
  );
  const workbenchBindings = hasCompleteGroupedBinding
    ? topics.map((topic) => {
        const workbench = topic.workbench || topic.shared_snapshot;
        if (!workbench) throw new Error("Grouped workbench binding became incomplete");
        return {
          topicId: topic.id,
          workbenchId: workbench.id,
          workbenchRevision: workbench.revision,
        };
      })
    : undefined;
  return {
    proposalSnapshotHash: snapshotHash,
    proposalGroupId: first.proposal_group_id,
    workbenchId: canonical?.id,
    workbenchRevision: canonical?.revision,
    workbenchBindings,
  };
}

function isPackageReviewTopic(topic: TopicView): boolean {
  return topic.state !== "RESOLVED" && hasPackageSurface(topic);
}

function isWorkingAgreementTopic(topic: TopicView): boolean {
  return topic.state === "PROPOSED" && hasConfirmablePackage(topic);
}

function topicStateLabel(topic: TopicView): string {
  if (topic.state === "PROPOSED") return "PROPOSED";
  if (topic.state === "RESOLVED") return "AGREED";
  if (topic.state === "PARTIAL") return "PARTIAL";
  return "OPEN";
}

function topicActivityLabel(topic: TopicView, state: SessionState): string | null {
  if (topic.state !== "PARTIAL") return null;
  if (state.status === "COMPLETED") return "Ended";
  if (topic.activity === "parked") return "Parked";
  if (topic.activity === "waiting") return "Waiting";
  return "Active";
}

function topicReplyText(topic: TopicView, section?: ArtifactSection): string {
  const workbench = topic.workbench || topic.shared_snapshot;
  return (workbench?.text || "").trim();
}

export function topicWorkbenchText(topic: TopicView, section?: ArtifactSection): string {
  const workbench = topic.workbench || topic.shared_snapshot;
  if (workbench?.text?.trim()) return workbench.text.trim();

  // A resolved topic's artifact section is its committed, participant-visible
  // record. Unlike an open topic's working draft, it is safe to use as the
  // expandable content when the live workbench has been cleared at close.
  return topic.state === "RESOLVED" ? (section?.text || "").trim() : "";
}

export function isReplyTargetStale(
  target: ReplyTarget | null,
  state: SessionState | null,
): boolean {
  if (!target || !state) return false;
  const topic = state.topics.find((item) => item.id === target.topicId);
  if (!topic) return true;
  if (target.frontierQuestionId) {
    return topic.frontier_question?.id !== target.frontierQuestionId
      || topic.frontier_question.status !== "open";
  }
  if (target.sharedSnapshotId) {
    const workbench = topic.workbench || topic.shared_snapshot;
    return workbench?.id !== target.sharedSnapshotId
      || workbench.revision !== target.sharedSnapshotRevision;
  }
  return false;
}

type PartialRecordRow = {
  key: "partial" | "unresolved" | "next" | "questions" | "note";
  label: string;
  value: string;
};

const PARTIAL_RECORD_LABELS: Array<{
  key: PartialRecordRow["key"];
  label: string;
  patterns: string[];
}> = [
  { key: "partial", label: "Partial agreement", patterns: ["partial agreement"] },
  { key: "unresolved", label: "Unresolved", patterns: ["unresolved"] },
  { key: "next", label: "Next step", patterns: ["next step"] },
  { key: "questions", label: "Questions", patterns: ["question", "questions"] },
];

type PartialRecordQuestion = {
  id: string;
  value: string;
};

function partialRecordLabelPattern() {
  return PARTIAL_RECORD_LABELS
    .flatMap((item) => item.patterns)
    .map((pattern) => pattern.replace(" ", "\\s+"))
    .join("|");
}

export function parsePartialRecord(text: string): PartialRecordRow[] {
  const source = text.trim();
  if (!source) return [];
  const labelPattern = partialRecordLabelPattern();
  const matcher = new RegExp(
    `(?:^|\\s)(?:[-*]\\s*)?(${labelPattern})\\s*:\\s*([\\s\\S]*?)(?=\\s+(?:[-*]\\s*)?(?:${labelPattern})\\s*:|$)`,
    "gi",
  );
  const rows: PartialRecordRow[] = [];
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(source)) !== null) {
    const label = match[1].toLowerCase().replace(/\s+/g, " ");
    const def = PARTIAL_RECORD_LABELS.find((item) => item.patterns.includes(label));
    const value = (match[2] || "").trim();
    if (def && value) {
      rows.push({ key: def.key, label: def.label, value });
    }
  }
  if (rows.length > 0) return rows;
  return [{ key: "note", label: "Working record", value: source }];
}

function splitExplicitQuestions(value: string): string[] {
  const lines = value
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  const candidates = lines.length > 1 ? lines : [value.trim()];
  return candidates.flatMap((candidate) => {
    const questionSentences = candidate.match(/[^?]+?\?/g)?.map((part) => (
      part.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim()
    )) || [];
    if (questionSentences.length > 0) return questionSentences;
    return [candidate];
  }).filter(Boolean);
}

function splitQuestionSentences(value: string): string[] {
  return value.match(/[^?]+?\?/g)?.map((part) => part.trim()).filter(Boolean) || [];
}

export function extractPartialRecordQuestions(rows: PartialRecordRow[]): PartialRecordQuestion[] {
  const questions: PartialRecordQuestion[] = [];
  const seen = new Set<string>();
  const addQuestion = (value: string) => {
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    questions.push({ id: `question-${questions.length + 1}`, value: cleaned });
  };
  for (const row of rows) {
    if (row.key === "questions") {
      splitExplicitQuestions(row.value).forEach(addQuestion);
    } else if (row.key === "next") {
      splitQuestionSentences(row.value).forEach(addQuestion);
    }
  }
  return questions;
}

export interface SessionTakeaways {
  pace: string[];
  convergence: string[];
  closure: string[];
}

export function buildSessionTakeaways(state: SessionState): SessionTakeaways {
  const takeaways = state.session_takeaways;
  return {
    pace: takeaways?.pace ? [takeaways.pace] : [],
    convergence: takeaways?.convergence ? [takeaways.convergence] : [],
    closure: takeaways?.closure ? [takeaways.closure] : [],
  };
}

function SessionTakeawaysPanel({ state }: { state: SessionState }) {
  const takeaways = buildSessionTakeaways(state);
  const groups = [
    {
      key: "ground",
      label: "Pace",
      items: takeaways.pace,
      empty: "No process timing observation is available.",
    },
    {
      key: "open",
      label: "Convergence",
      items: takeaways.convergence,
      empty: "No convergence observation is available.",
    },
    {
      key: "questions",
      label: "Closure",
      items: takeaways.closure,
      empty: "No closure observation is available.",
    },
  ];
  return (
    <section className="session-takeaways" aria-labelledby="session-takeaways-title">
      <div className="session-takeaways-head">
        <h3 id="session-takeaways-title">Session takeaways</h3>
        <span>Process observations · non-binding</span>
      </div>
      <div className="session-takeaways-grid">
        {groups.map((group) => (
          <div className={`session-takeaway ${group.key}`} key={group.key}>
            <div className="session-takeaway-label">{group.label}</div>
            {group.items.length ? (
              <ul>{group.items.map((item, index) => <li key={`${group.key}-${index}`}>{item}</li>)}</ul>
            ) : (
              <p>{group.empty}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function visibleSnapshotLabel(topic: TopicView, state: SessionState): string | null {
  const visible = topic.visible_snapshot_hashes || {};
  const accepted = topic.accepted_snapshot_hashes || {};
  const visibleCount = state.participants.filter((p) => Boolean(visible[p.id])).length;
  const acceptedCount = state.participants.filter((p) => Boolean(accepted[p.id])).length;
  if (!topic.proposal_group_id && !topic.proposal_snapshot_hash && visibleCount === 0 && acceptedCount === 0) {
    return null;
  }
  const total = state.participants.length || 1;
  if (acceptedCount > 0) return `Package snapshot: ${acceptedCount}/${total} accepted`;
  if (visibleCount > 0) return `Package snapshot: visible to ${visibleCount}/${total}`;
  return "Package snapshot: being prepared";
}

function PartialRecordDetails({
  topic,
  state,
  text,
  onReply,
}: {
  topic: TopicView;
  state: SessionState;
  text: string;
  onReply: (target: ReplyTarget) => void;
}) {
  const [questionOpen, setQuestionOpen] = useState(false);
  const snapshot = visibleSnapshotLabel(topic, state);
  const name = displayTopicName(topic.name);
  const frontier = topic.frontier_question?.status === "open"
    ? topic.frontier_question
    : null;
  const canAnswer = Boolean(frontier && state.status !== "COMPLETED");
  const questionId = frontier ? `frontier-question-${frontier.id}` : undefined;
  useEffect(() => {
    setQuestionOpen(false);
  }, [frontier?.id]);
  return (
    <div className="partial-record" data-testid={`partial-record-${topic.id}`}>
      <div className="partial-snapshot">
        <div className="partial-snapshot-label">Where things stand</div>
        <div className="partial-snapshot-text">
          {text || "The topic is mapped as partial, but no shared snapshot is available yet."}
        </div>
      </div>
      {frontier ? (
        <aside className="frontier-question" aria-label={`Private question for ${name}`}>
          <button
            type="button"
            className="frontier-question-head"
            aria-expanded={questionOpen}
            aria-controls={questionId}
            onClick={() => setQuestionOpen((open) => !open)}
          >
            <span className="frontier-question-lock" aria-hidden="true">{"\u25C6"}</span>
            <span>Private question</span>
            <span className="frontier-question-note">Only you can see this</span>
            <span className="frontier-question-toggle-label">
              {questionOpen ? "Hide" : "Show"}
              <span className="frontier-question-chevron" aria-hidden="true">
                {questionOpen ? "\u25BE" : "\u25B8"}
              </span>
            </span>
          </button>
          {questionOpen ? (
            <div className="frontier-question-body" id={questionId}>
              <div className="frontier-question-text">{frontier.question}</div>
              {canAnswer ? (
                <button
                  type="button"
                  className="frontier-question-answer"
                  onClick={() => onReply({
                    id: frontier.id,
                    title: `${name} private question`,
                    text: frontier.question,
                    topicId: topic.id,
                    frontierQuestionId: frontier.id,
                  })}
                >
                  Answer privately
                </button>
              ) : (
                <span className="frontier-question-ended">Saved as a continuation question</span>
              )}
            </div>
          ) : null}
        </aside>
      ) : null}
      {snapshot ? <div className="partial-record-meta">{snapshot}</div> : null}
    </div>
  );
}

function normalizeAgreementText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function workingAgreementText(topics: TopicView[], sectionByTopic: Map<string, ArtifactSection>): string {
  const texts: string[] = [];
  const seen = new Set<string>();
  for (const topic of topics) {
    const text = topicReplyText(topic, sectionByTopic.get(topic.id));
    const key = normalizeAgreementText(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    texts.push(text);
  }
  return texts.join("\n\n");
}

export function workingAgreementReplyTarget(
  topics: TopicView[],
  text: string,
): ReplyTarget | null {
  const topic = topics[0];
  if (!topic || !text.trim()) return null;
  const canonical = topics.length === 1
    ? (topic.workbench || topic.shared_snapshot)
    : null;
  return {
    id: topic.visible_surface_id || canonical?.id || topic.id,
    title: topics.map((item) => displayTopicName(item.name)).join(" + "),
    text,
    surfaceId: topic.visible_surface_id || undefined,
    topicId: topic.id,
    sharedSnapshotId: canonical?.id,
    sharedSnapshotRevision: canonical?.revision,
  };
}

function commonPackageSnapshotHash(topics: TopicView[]): string {
  const first = topics[0]?.proposal_snapshot_hash || "";
  if (!first) return "";
  return topics.every((topic) => topic.proposal_snapshot_hash === first) ? first : "";
}

export function packageActionableByParticipant(
  topics: TopicView[],
  participantId: string,
  snapshotHash = commonPackageSnapshotHash(topics),
): boolean {
  if (!participantId || topics.length === 0) return false;
  if (!topics.every((topic) => topic.state === "PROPOSED")) return false;
  const canonical = topics.length === 1
    ? (topics[0].workbench || topics[0].shared_snapshot)
    : null;
  if (canonical) return true;
  return Boolean(
    snapshotHash
    && topics.every(
      (topic) => (topic.visible_snapshot_hashes || {})[participantId] === snapshotHash,
    ),
  );
}

export function packageAcceptedByParticipant(
  topics: TopicView[], participantId: string, snapshotHash: string,
): boolean {
  if (!participantId || topics.length === 0) return false;
  return topics.every((topic) => {
    const canonical = topic.workbench || topic.shared_snapshot;
    if (canonical) {
      return topic.accepted_workbench_ids?.[participantId] === canonical.id
        && topic.accepted_workbench_revisions?.[participantId] === canonical.revision;
    }
    return Boolean(
      snapshotHash
      && (topic.accepted_snapshot_hashes || {})[participantId] === snapshotHash,
    );
  });
}

function closeStatus(p: Participant): { kind: "done" | "talking" | "reviewing"; label: string } {
  // Per-party sign-off state for the close banner. By READY_TO_END every topic
  // is already unanimously accepted, so the only pending axis is who has pressed
  // Done. Coordination metadata only — never protected content.
  if (p.ready_to_end) return { kind: "done", label: "Done ✓" };
  if (p.is_typing) return { kind: "talking", label: "typing…" };
  if (p.bot_busy) return { kind: "talking", label: "composing…" };
  return { kind: "reviewing", label: "reviewing…" };
}

function ActiveTopicChip({
  topic,
  state,
  section,
  onReply,
}: {
  topic: TopicView;
  state: SessionState;
  section?: ArtifactSection;
  onReply: (target: ReplyTarget) => void;
}) {
  const pendingLabel = acceptanceLabel(topic, state);
  const replyText = topicReplyText(topic, section);
  const canReply = replyText.length > 0;
  const name = displayTopicName(topic.name);
  const clickLabel = canReply
    ? `Reply about ${name}`
    : `${name} is open`;
  return (
    <div className={`topic-chip ${topic.state.toLowerCase()}`} data-topic-id={topic.id}>
      <button
        type="button"
        className={`topic-chip-active-button ${canReply ? "" : "not-replyable"}`}
        onClick={() => canReply && onReply({
          id: topic.visible_surface_id || topic.id,
          title: name,
          text: replyText,
          surfaceId: topic.visible_surface_id || undefined,
          topicId: topic.id,
        })}
        disabled={!canReply}
        title={clickLabel}
        aria-label={clickLabel}
      >
        <span className="topic-chip-text">
          <span className="name">{name}</span>
        </span>
        <span className="topic-chip-state-row">
          <span className="state">{topicStateLabel(topic)}</span>
          {pendingLabel ? <span className="state">{pendingLabel}</span> : null}
        </span>
        <span className="topic-chip-reply-icon" aria-hidden="true">{"↩"}</span>
      </button>
    </div>
  );
}

function WorkingAgreementChip({
  topics,
  state,
  sectionByTopic,
  onReply,
  onAcceptPackage,
}: {
  topics: TopicView[];
  state: SessionState;
  sectionByTopic: Map<string, ArtifactSection>;
  onReply: (target: ReplyTarget) => void;
  onAcceptPackage: (topic: TopicView, binding: WorkbenchChangeBinding) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const text = workingAgreementText(topics, sectionByTopic);
  const replyTarget = workingAgreementReplyTarget(topics, text);
  const canReply = replyTarget !== null;
  const topicNames = topics.map((topic) => displayTopicName(topic.name));
  const title = topics.length === 1 ? displayTopicName(topics[0].name) : "Package review";
  const replyTitle = topicNames.join(" + ");
  const pendingLabel = agreementAcceptanceLabel(topics, state);
  const snapshotHash = commonPackageSnapshotHash(topics);
  const changeBinding = workbenchChangeBinding(topics);
  const acceptedByMe = packageAcceptedByParticipant(
    topics, state.participant_id, snapshotHash,
  );
  const changesRequestedByMe = topics.some(
    (topic) => topic.acceptance?.[state.participant_id] === "rejected",
  );
  const actionReady = packageActionableByParticipant(
    topics, state.participant_id, snapshotHash,
  );
  const acceptanceReady = topics.every(isWorkingAgreementTopic);
  const canAccept = Boolean(actionReady && !acceptedByMe && !accepting);
  const hasPartialDetails = topics.length === 1 && Boolean(topics[0].frontier_question);
  const acceptLabel = acceptedByMe
    ? "Accepted"
    : accepting
      ? "Accepting..."
      : actionReady
        ? "Accept"
        : "Preparing...";
  const handleAccept = async () => {
    if (!canAccept) return;
    setAccepting(true);
    try {
      await Promise.resolve(onAcceptPackage(topics[0], changeBinding));
    } finally {
      setAccepting(false);
    }
  };
  return (
    <div
      className={`topic-chip partial working-agreement ${open ? "open" : ""}`}
      data-topic-ids={topics.map((topic) => topic.id).join(",")}
    >
      <div className="topic-chip-row">
        <button
          type="button"
          className="topic-chip-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <span className="topic-chip-chevron">{open ? "\u25BC" : "\u25B6"}</span>
          <span className="topic-chip-text">
            <span className="name">{title}</span>
            <span className="state">{changesRequestedByMe ? "Changes requested" : pendingLabel || "Package review"}</span>
          </span>
        </button>
        {canReply && (
          <button
            type="button"
            className="topic-chip-reply"
            onClick={() => replyTarget && onReply(replyTarget)}
            title={`Reply about ${replyTitle}`}
            aria-label={`Reply about ${replyTitle}`}
          >
            {"\u21A9"}
          </button>
        )}
      </div>
      {topics.length > 1 ? (
        <div className="working-agreement-topics" aria-label="Linked topics">
          {topics.map((topic) => (
            <span key={topic.id} className="working-agreement-topic">{displayTopicName(topic.name)}</span>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="topic-chip-resolution working-agreement-body">
          {!hasPartialDetails ? (
            <div className="working-agreement-text">
              {text || "The current workbench revision is being prepared."}
            </div>
          ) : null}
          {changesRequestedByMe ? (
            <div data-testid="working-agreement-changes-requested-state" className="working-agreement-changes-requested-state">
              Changes requested
            </div>
          ) : null}
          {hasPartialDetails ? (
            <PartialRecordDetails
              topic={topics[0]}
              state={state}
              text={text}
              onReply={onReply}
            />
          ) : null}
          {acceptanceReady ? <div className="working-agreement-actions">
            <button
              type="button"
              className="working-agreement-accept"
              data-testid="working-agreement-accept"
              data-accepted={acceptedByMe ? "true" : undefined}
              onClick={handleAccept}
              disabled={!canAccept}
              title={
                acceptedByMe
                  ? "You accepted this working agreement"
                  : "Accept this exact visible working agreement"
              }
            >
              {acceptLabel}
            </button>
          </div> : null}
        </div>
      ) : null}
    </div>
  );
}

function CompleteTopicChip({
  topic,
  state,
  section,
  onReply,
}: {
  topic: TopicView;
  state: SessionState;
  section?: ArtifactSection;
  onReply: (target: ReplyTarget) => void;
}) {
  const [open, setOpen] = useState(topic.state === "PARTIAL");
  const text = topicWorkbenchText(topic, section);
  const snapshot = visibleSnapshotLabel(topic, state);
  const canExpand = text.length > 0 || Boolean(snapshot) || Boolean(topic.frontier_question);
  const replyText = topic.state === "PARTIAL" ? text : (text || snapshot || "");
  const name = displayTopicName(topic.name);

  return (
    <div
      className={`topic-chip ${topic.state.toLowerCase()} ${open ? "open" : ""}`}
      data-topic-id={topic.id}
    >
      <div className="topic-chip-row">
        <button
          type="button"
          className="topic-chip-toggle"
          onClick={() => canExpand && setOpen(!open)}
          disabled={!canExpand}
          aria-expanded={open}
        >
          <span className="topic-chip-chevron">{canExpand ? (open ? "\u25BC" : "\u25B6") : "\u00B7"}</span>
          <span className="topic-chip-text">
            <span className="name">{name}</span>
            <span className="topic-chip-state-row">
              <span className="state">{topicStateLabel(topic)}</span>
              {topicActivityLabel(topic, state) ? (
                <span className={`topic-activity ${topic.activity || "active"}`}>
                  {topicActivityLabel(topic, state)}
                </span>
              ) : null}
            </span>
          </span>
        </button>
        {canExpand && replyText && (
          <button
            type="button"
            className="topic-chip-reply"
            onClick={() => onReply({
              id: topic.shared_snapshot?.id || topic.visible_surface_id || topic.id,
              title: name,
              text: replyText,
              surfaceId: topic.visible_surface_id || undefined,
              topicId: topic.id,
              sharedSnapshotId: topic.state === "PARTIAL" ? topic.shared_snapshot?.id : undefined,
              sharedSnapshotRevision: topic.state === "PARTIAL" ? topic.shared_snapshot?.revision : undefined,
            })}
            title={`Reply about ${name}`}
            aria-label={`Reply about ${name}`}
          >
            {"\u21A9"}
          </button>
        )}
      </div>
      {open && canExpand && (
        <div className="topic-chip-resolution">
          {topic.state === "PARTIAL" ? (
            <PartialRecordDetails
              topic={topic}
              state={state}
              text={text}
              onReply={onReply}
            />
          ) : (
            text
          )}
        </div>
      )}
    </div>
  );
}

export function productiveCloseStructurallyEligible(state: SessionState): boolean {
  return state.topics.length > 0 && state.topics.every((topic) => {
    if (topic.state === "RESOLVED") return true;
    const workbench = topic.workbench || topic.shared_snapshot;
    return topic.state === "PARTIAL" && Boolean(workbench?.text?.trim());
  });
}

export function participantReadyForProductiveClose(
  participant: Participant,
  recommendation: NonNullable<SessionState["productive_close"]>,
): boolean {
  return Boolean(
    participant.ready_to_end
    && participant.ready_recommendation_id === recommendation.recommendation_id
    && participant.ready_outcome_revision === recommendation.outcome_revision
  );
}

function ProductiveClosePanel({
  state,
  onMarkReady,
}: {
  state: SessionState;
  onMarkReady: (ready: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState<"ready" | "continue" | null>(null);
  const recommendation = state.productive_close;
  if (
    state.status !== "ACTIVE"
    || recommendation?.status !== "recommended"
    || !recommendation.recommendation_id
    || !recommendation.outcome_revision
  ) return null;

  const structurallyEligible = productiveCloseStructurallyEligible(state);
  const self = state.participants.find((participant) => participant.id === state.participant_id);
  const isCurrentReady = (participant: Participant) => (
    participantReadyForProductiveClose(participant, recommendation)
  );
  const selfReady = self ? isCurrentReady(self) : false;
  const readyCount = state.participants.filter(isCurrentReady).length;

  const choose = async (ready: boolean) => {
    setBusy(ready ? "ready" : "continue");
    try {
      await onMarkReady(ready);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="productive-close" data-testid="productive-close">
      <div className="productive-close-kicker">Productive stopping point</div>
      <h4>This may be a productive place to close</h4>
      <p>
        I think we have taken the discussion as far as is currently reasonable.
        You can keep talking for as long as it remains useful, but there is
        enough shared ground to close with a productive outcome. Some topics
        will remain clearly marked as partial.
      </p>
      {recommendation.participant_safe_reason ? (
        <p className="productive-close-reason">{recommendation.participant_safe_reason}</p>
      ) : null}
      <div className="productive-close-status">
        {readyCount} of {state.participants.length} ready for this version
      </div>
      {!structurallyEligible ? (
        <div className="productive-close-updating">
          The visible outcome changed. The mediator is preparing an updated stopping point.
        </div>
      ) : null}
      <div className="productive-close-actions">
        <button
          type="button"
          className="btn primary"
          data-testid="productive-close-ready"
          onClick={() => void choose(true)}
          disabled={busy !== null || selfReady || !structurallyEligible}
        >
          {selfReady ? "Ready marked" : busy === "ready" ? "Marking ready..." : "Ready to close"}
        </button>
        <button
          type="button"
          className="btn productive-close-continue"
          data-testid="productive-close-continue"
          onClick={() => void choose(false)}
          disabled={busy !== null}
        >
          {busy === "continue" ? "Continuing..." : selfReady ? "Withdraw readiness" : "Keep discussing"}
        </button>
      </div>
    </section>
  );
}

function TopicRail({
  state,
  onReply,
  onAcceptPackage,
  onMarkReady,
  sessionId,
  participantId,
}: {
  state: SessionState;
  onReply: (target: ReplyTarget) => void;
  onAcceptPackage: (topic: TopicView, binding: WorkbenchChangeBinding) => Promise<void>;
  onMarkReady: (ready: boolean) => Promise<void>;
  sessionId: string | null;
  participantId: string | null;
}) {
  const [protectionOpen, setProtectionOpen] = useState(sessionId === "mock-01");
  const [protectionHeight, setProtectionHeight] = useState<number | null>(null);
  const stateOrder: Record<TopicView["state"], number> = {
    GATHERING: 0,
    PROPOSED: 1,
    PARTIAL: 2,
    RESOLVED: 3,
  };
  const sortedTopics = [...state.topics].sort((a, b) => {
    const byState = stateOrder[a.state] - stateOrder[b.state];
    if (byState !== 0) return byState;
    return displayTopicName(a.name).localeCompare(displayTopicName(b.name));
  });
  const sectionByTopic = new Map<string, ArtifactSection>();
  for (const sec of state.artifact?.sections || []) {
    sectionByTopic.set(sec.topic_id, sec);
  }
  const renderedTopicIds = new Set<string>();
  const groupedPackageReviewTopics = (topic: TopicView): TopicView[] => {
    if (!isPackageReviewTopic(topic) || !topic.proposal_group_id) return [topic];
    const group = sortedTopics.filter(
      (candidate) =>
        isPackageReviewTopic(candidate)
        && candidate.proposal_group_id === topic.proposal_group_id,
    );
    if (group.length < 2) return [topic];
    const keys = group.map((candidate) =>
      normalizeAgreementText(topicReplyText(candidate, sectionByTopic.get(candidate.id))),
    );
    const first = keys[0];
    if (!first || !keys.every((key) => key === first)) return [topic];
    return group;
  };

  return (
    <aside
      className="rail"
      style={protectionHeight === null ? undefined : {
        "--private-terms-height": `${protectionHeight}px`,
      } as CSSProperties}
    >
      <div className="topic-section">
        <div className="section-head"><h3>Topics</h3></div>
        <div className="topic-list">
          <ProductiveClosePanel state={state} onMarkReady={onMarkReady} />
          {sortedTopics.map((topic) => {
          if (renderedTopicIds.has(topic.id)) return null;
          if (isPackageReviewTopic(topic)) {
            const topics = groupedPackageReviewTopics(topic);
            for (const item of topics) renderedTopicIds.add(item.id);
            return (
              <WorkingAgreementChip
                key={topics.length > 1 ? topics[0].proposal_group_id || topics[0].id : topics[0].id}
                topics={topics}
                state={state}
                sectionByTopic={sectionByTopic}
                onReply={onReply}
                onAcceptPackage={onAcceptPackage}
              />
            );
          }
          renderedTopicIds.add(topic.id);
          return topic.state === "RESOLVED" || topic.state === "PARTIAL" ? (
            <CompleteTopicChip
              key={topic.id}
              topic={topic}
              state={state}
              section={sectionByTopic.get(topic.id)}
              onReply={onReply}
            />
          ) : (
            <ActiveTopicChip
              key={topic.id}
              topic={topic}
              state={state}
              section={sectionByTopic.get(topic.id)}
              onReply={onReply}
            />
          );
          })}
        </div>
      </div>
      {sessionId && participantId ? (
        <ProtectionSection
          sessionId={sessionId}
          participantId={participantId}
          open={protectionOpen}
          onOpenChange={setProtectionOpen}
          onHeightChange={setProtectionHeight}
        />
      ) : null}
    </aside>
  );
}

const DEV_PREVIEW_TIME = "2026-07-06T12:00:00.000Z";

const DEV_PREVIEW_STATE: SessionState = {
  session_id: "dev-preview",
  participant_id: "preview-you",
  session_name: "Mock session walkthrough",
  status: "ACTIVE",
  output_type: "Resolution Summary",
  welcome_message: "",
  mediation_phase: "MAPPING",
  phase_updated_at: DEV_PREVIEW_TIME,
  phase_suggestions: [],
  participants: [
    {
      id: "preview-you",
      display_name: "Alex",
      joined_at: DEV_PREVIEW_TIME,
      last_active_at: DEV_PREVIEW_TIME,
      is_typing: false,
      ready_to_end: false,
      bot_busy: false,
      last_message_at: DEV_PREVIEW_TIME,
    },
    {
      id: "preview-other",
      display_name: "Other side",
      joined_at: DEV_PREVIEW_TIME,
      last_active_at: DEV_PREVIEW_TIME,
      is_typing: false,
      ready_to_end: false,
      bot_busy: true,
      last_message_at: null,
    },
  ],
  topics: [
    {
      id: "preview-topic-1",
      name: "Launch support coverage",
      state: "GATHERING",
      draft_status: "NONE",
      working_draft: "The mock mediator is mapping who owns support after launch and what capacity is realistic.",
      acceptance: {},
    },
    {
      id: "preview-topic-2",
      name: "Support rotation option",
      state: "PARTIAL",
      draft_status: "NONE",
      working_draft: "A two-week support rotation is taking shape, but the first owner still needs to be named.",
      shared_snapshot: {
        id: "mock-workbench-1",
        revision: 1,
        text: "Keep the launch date under review while a named support owner covers the first two weeks.",
        updated_at: DEV_PREVIEW_TIME,
        topic_revision: 1,
      },
      acceptance: {},
    },
  ],
  my_entries: [],
  my_directives: [],
  pending_directives: [],
  artifact: {
    version: 0,
    sections: [],
    unresolved_topic_ids: ["preview-topic-1", "preview-topic-2"],
    updated_at: DEV_PREVIEW_TIME,
  },
  mediator_log: [],
  mediator_timer: { status: "idle", seconds_remaining: 0 },
};

function DevSessionPreview() {
  const noopReply = () => {};
  const noopAccept = async () => {};
  return (
    <section className="page active session-page dev-session-preview">
      <div className="mediation">
        <div className="presence">
          <div className="presence-nodes">
            {DEV_PREVIEW_STATE.participants.map((participant) => (
              <div className="p-node" key={participant.id}>
                <div className={`p-avatar ${participant.bot_busy ? "bot-thinking" : ""}`}>
                  {fmtInitials(participant.display_name)}
                </div>
                <div className="p-meta">
                  <span className="p-name">
                    {participant.display_name}{participant.id === DEV_PREVIEW_STATE.participant_id ? " (you)" : ""}
                  </span>
                  <span className="p-status">{participant.bot_busy ? "bot composing..." : "active"}</span>
                </div>
              </div>
            ))}
            <div className="p-node">
              <div className="p-avatar mediator">W</div>
              <div className="p-meta">
                <span className="p-name">Mediator</span>
                <span className="p-status">coordinating</span>
              </div>
            </div>
            <PhaseRail
              state={DEV_PREVIEW_STATE}
              suggesting={false}
              onSuggestAdvance={() => {}}
            />
          </div>
        </div>
        <div className="mediation-grid">
          <TopicRail
            state={DEV_PREVIEW_STATE}
            onReply={noopReply}
            onAcceptPackage={noopAccept}
            onMarkReady={async () => {}}
            sessionId="mock-01"
            participantId="mock-you"
          />
          <main className="chat">
            <div className="chat-head">
              <div>
                <div className="chat-title">Private Advocate Chat</div>
                <div className="chat-subtitle">Mock session · synthetic content</div>
              </div>
              <div className="chat-head-badges">
                <div className="chat-badge">Mock only</div>
                <div className="chat-badge">Visible only to you</div>
              </div>
            </div>
            <div className="chat-messages">
              <ChatMessage
                role="assistant"
                text="This is a mock Wediate session. The participants, topics, private terms, and replies are synthetic and stay in this browser. It is here to show the interface, not live AI behavior."
                ts={DEV_PREVIEW_TIME}
              />
              <ChatMessage
                role="user"
                text="I want to understand how a private constraint becomes a shared next step."
                ts={DEV_PREVIEW_TIME}
              />
              <ChatMessage
                role="assistant"
                text="The mock shows the shape: you talk privately with an advocate, topics make the work visible, and an exact detail stays held until you choose to release it."
                ts={DEV_PREVIEW_TIME}
              />
              <ChatStatusChip status={{ label: "Mock mode · no network", tone: "waiting" }} />
            </div>
            <div className="composer">
              <div className="composer-row">
                <textarea
                  value=""
                  placeholder="Mock mode: sending is disabled. The production service stays private."
                  disabled
                  readOnly
                />
                <button type="button" className="send-btn" disabled>
                  Mock only
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}

export function SessionPage() {
  const state = useAppStore((store) => store.sessionState);
  const draftMessages = useAppStore((store) => store.draftMessages);
  const sending = useAppStore((store) => store.sending);
  const sendMessage = useAppStore((store) => store.sendMessage);
  const acceptPackage = useAppStore((store) => store.acceptPackage);
  const markReady = useAppStore((store) => store.markReady);
  const endSessionEarly = useAppStore((store) => store.endSessionEarly);
  const flashUntil = useAppStore((store) => store.mediatorFlashUntil);
  const refreshState = useAppStore((store) => store.refreshState);
  const lastStateRefreshAt = useAppStore((store) => store.lastStateRefreshAt);
  const refreshHighlights = useAppStore((store) => store.refreshHighlights);
  const redactionHighlights = useAppStore((store) => store.redactionHighlights);
  const redactionMessageProtections = useAppStore((store) => store.redactionMessageProtections);
  const sessionId = useAppStore((store) => store.sessionId);
  const participantId = useAppStore((store) => store.participantId);
  const debugMode = useAppStore((store) => store.health?.dev_mode === "1");
  const testMode = useAppStore((store) => store.health?.test_mode === "1");
  const wediateEnv = useAppStore((store) => store.health?.wediate_env ?? store.health?.app_env ?? "");
  const mockMode = wediateEnv.trim().toLowerCase() === "public-demo";
  const traceMode = debugMode || testMode || wediateEnv.trim().toLowerCase() === "development";
  const [mediatorTriggering, setMediatorTriggering] = useState(false);
  const [mediatorTriggerError, setMediatorTriggerError] = useState<string | null>(null);
  const [phaseSuggesting, setPhaseSuggesting] = useState(false);
  const [phaseSuggestError, setPhaseSuggestError] = useState<string | null>(null);
  const [endingEarly, setEndingEarly] = useState(false);
  const [endEarlyConfirmOpen, setEndEarlyConfirmOpen] = useState(false);
  const [sharedOutcomeCopied, setSharedOutcomeCopied] = useState(false);

  // Poll the read-only inline redaction highlights. Same cadence as the
  // protection panel (8s) so authorizing an item flips its chat highlight
  // from protected to shared within a cycle. Fetch once on mount too.
  useEffect(() => {
    if (!sessionId || !participantId) return;
    let cancelled = false;
    void refreshHighlights();
    const id = window.setInterval(() => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void refreshHighlights();
    }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId, participantId, refreshHighlights]);

  // Poll session state while the page is mounted. Background events that
  // don't originate from the user — bot openings on join, mediator
  // cycles every 30s, proactive heartbeats — need a nudge to surface.
  // Skip while sending (the stream handler refreshes at the end) and
  // while the tab is hidden to avoid waking the backend for nothing.
  useEffect(() => {
    if (!sessionId || !participantId) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (sending) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void refreshState();
    };
    const id = window.setInterval(tick, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId, participantId, sending, refreshState]);
  const [message, setMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Dev-only autofill: suggest the acting party's next reply (optionally in a
  // pinned persona) so manual both-sides testing isn't bottlenecked on typing.
  // Persona is remembered per-participant in this browser so each side's tab
  // keeps its own behaviour across reloads. Gated on debugMode below.
  const personaKey = participantId ? `wediate_dev_persona:${participantId}` : null;
  const [persona, setPersona] = useState("");
  const [personaOpen, setPersonaOpen] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [chipTraceCopied, setChipTraceCopied] = useState(false);
  useEffect(() => {
    if (!personaKey) return;
    try {
      setPersona(window.localStorage.getItem(personaKey) ?? "");
    } catch {
      setPersona("");
    }
  }, [personaKey]);
  const savePersona = (value: string) => {
    setPersona(value);
    if (!personaKey) return;
    try {
      if (value.trim()) window.localStorage.setItem(personaKey, value);
      else window.localStorage.removeItem(personaKey);
    } catch {
      // best-effort; persona just won't persist if storage is unavailable
    }
  };
  const handleAutofill = async () => {
    if (!sessionId || !participantId || autofilling) return;
    setAutofilling(true);
    setAutofillError(null);
    try {
      const { suggestion } = await api.autofillReply(sessionId, participantId, persona);
      setMessage(suggestion);
      // Defer resize/focus until the textarea has the new value.
      window.setTimeout(() => {
        autoResize();
        textareaRef.current?.focus();
      }, 0);
    } catch (err) {
      setAutofillError(err instanceof Error ? err.message : "Autofill failed");
    } finally {
      setAutofilling(false);
    }
  };

  const handleMediatorTrigger = async () => {
    if (!sessionId || !participantId || mediatorTriggering) return;
    setMediatorTriggering(true);
    setMediatorTriggerError(null);
    try {
      await api.triggerMediator(sessionId, participantId);
      await refreshState();
    } catch (err) {
      setMediatorTriggerError(err instanceof Error ? err.message : "Mediator trigger failed");
    } finally {
      setMediatorTriggering(false);
    }
  };

  const handlePhaseSuggestAdvance = async () => {
    if (!sessionId || !participantId || phaseSuggesting) return;
    setPhaseSuggesting(true);
    setPhaseSuggestError(null);
    try {
      await api.suggestPhaseAdvance(sessionId, participantId);
      await refreshState();
    } catch (err) {
      setPhaseSuggestError(err instanceof Error ? err.message : "Next phase signal failed");
    } finally {
      setPhaseSuggesting(false);
    }
  };

  const handleEndSessionEarly = async () => {
    if (!sessionId || !participantId || endingEarly || state?.status === "COMPLETED") return;
    setEndingEarly(true);
    try {
      await endSessionEarly();
      await refreshState();
      void downloadArtifactPdf(sessionId, participantId);
      setEndEarlyConfirmOpen(false);
    } finally {
      setEndingEarly(false);
    }
  };

  const handleCopySharedOutcome = async () => {
    if (!sessionId) return;
    await navigator.clipboard.writeText(buildSharedOutcomeUrl(sessionId));
    setSharedOutcomeCopied(true);
    window.setTimeout(() => setSharedOutcomeCopied(false), 1400);
  };

  const handleCopyChipTrace = async () => {
    if (!sessionId || !participantId) return;
    const trace = getChatStatusTrace(sessionId, participantId);
    if (!trace) return;
    await navigator.clipboard.writeText(JSON.stringify(trace, null, 2));
    setChipTraceCopied(true);
    window.setTimeout(() => setChipTraceCopied(false), 1400);
  };

  const startReply = (target: ReplyTarget) => {
    if (!target.text.trim()) return;
    setReplyingTo(target);
    textareaRef.current?.focus();
  };

  const replyTargetStale = isReplyTargetStale(replyingTo, state);

  const useLatestReplyTarget = () => {
    if (!replyingTo || !state) return;
    const topic = state.topics.find((item) => item.id === replyingTo.topicId);
    if (!topic) return;
    const name = displayTopicName(topic.name);
    if (replyingTo.frontierQuestionId && topic.frontier_question?.status === "open") {
      setReplyingTo({
        id: topic.frontier_question.id,
        title: `${name} private question`,
        text: topic.frontier_question.question,
        topicId: topic.id,
        frontierQuestionId: topic.frontier_question.id,
      });
      return;
    }
    const workbench = topic.workbench || topic.shared_snapshot;
    if (replyingTo.sharedSnapshotId && workbench) {
      setReplyingTo({
        id: workbench.id,
        title: name,
        text: workbench.text,
        topicId: topic.id,
        sharedSnapshotId: workbench.id,
        sharedSnapshotRevision: workbench.revision,
      });
    }
  };

  const handleAcceptPackage = async (topic: TopicView, binding: WorkbenchChangeBinding) => {
    await acceptPackage({
      topicId: topic.id,
      ...binding,
    });
  };

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, []);

  const combinedMessages = state ? buildCombinedMessages(state, draftMessages) : [];
  // Recompute once a second so the chiclet can flip to "reconnecting…" promptly
  // when polls stop landing (not just on the next successful poll's re-render).
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const pollStale = isPollStale({
    lastStateRefreshAt,
    now: nowTick,
    sending,
    documentHidden: typeof document !== "undefined" && document.hidden,
  });
  const botStatusExplanation = state ? explainBotStatusChip(state, draftMessages, { pollStale }) : null;
  const botStatusChip = botStatusExplanation?.status ?? null;

  useEffect(() => {
    if (!state || !participantId || !botStatusExplanation || !traceMode) return;
    recordChatStatusTrace(state.session_id, participantId, botStatusExplanation);
  }, [botStatusExplanation, participantId, state, traceMode]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [combinedMessages.length, sending]);

  const handleSend = async () => {
    const body = message.trim();
    if (!body || sending || state?.status === "COMPLETED") return;
    const replyContext = replyingTo
      ? {
          replyToSurfaceId: replyingTo.surfaceId,
          topicId: replyingTo.topicId,
          frontierQuestionId: replyingTo.frontierQuestionId,
          sharedSnapshotId: replyingTo.sharedSnapshotId,
          sharedSnapshotRevision: replyingTo.sharedSnapshotRevision,
        }
      : undefined;
    const capturedTarget = replyingTo;
    setMessage("");
    setReplyingTo(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    const sent = await sendMessage(body, replyContext);
    if (!sent) {
      setMessage(body);
      setReplyingTo(capturedTarget);
      window.setTimeout(() => {
        autoResize();
        textareaRef.current?.focus();
      }, 0);
    }
  };

  if (!state) {
    if (debugMode || testMode || mockMode) return <DevSessionPreview />;
    return (
      <section className="page active">
        <div className="lobby">
          <div className="panel"><div className="panel-inner">{sessionId ? "Loading session…" : "Enter or create a session first."}</div></div>
        </div>
      </section>
    );
  }
  const closingWithPartialWorkbench = state.topics.some((topic) => topic.state === "PARTIAL");
  const earlyEnded = state.status === "COMPLETED" && state.close_mode === "early";

  return (
    <section className="page active session-page">
      {endEarlyConfirmOpen ? (
        <div
          className="end-early-backdrop"
          role="presentation"
          onClick={() => {
            if (!endingEarly) setEndEarlyConfirmOpen(false);
          }}
        >
          <div
            className="end-early-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-early-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="end-early-title">End session early?</h2>
            <p>
              This closes the session for everyone and exports the current output.
              Unresolved topics stay marked as not agreed.
            </p>
            <div className="end-early-dialog-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setEndEarlyConfirmOpen(false)}
                disabled={endingEarly}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => void handleEndSessionEarly()}
                disabled={endingEarly}
              >
                {endingEarly ? "Ending..." : "End session"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mediation">
        <div className="presence">
          <div className="presence-nodes">
            {state.participants.map((participant) => {
              const lastMsg = participant.last_message_at ? Date.parse(participant.last_message_at) : 0;
              const sentRecent = lastMsg > 0 && Date.now() - lastMsg < 1500;
              const botBusy = participant.bot_busy ?? false;
              let status: string;
              if (participant.is_typing) status = "typing...";
              else if (botBusy) status = "bot composing...";
              else status = "active";
              const avatarClasses = [
                "p-avatar",
                participant.is_typing ? "typing" : "",
                botBusy ? "bot-thinking" : "",
                sentRecent ? "flash" : "",
              ].filter(Boolean).join(" ");
              return (
                <div className="p-node" key={participant.id}>
                  <div className={avatarClasses}>{fmtInitials(participant.display_name)}</div>
                  <div className="p-meta">
                    <span className="p-name">{participant.display_name}{participant.id === state.participant_id ? " (you)" : ""}</span>
                    <span className="p-status">{status}</span>
                  </div>
                </div>
              );
            })}
            {(() => {
              const mediatorStatus = mediatorTriggering
                ? "running now"
                : mediatorTriggerError
                  ? "trigger failed"
                  : state.status === "COMPLETED"
                    ? (earlyEnded ? "ended early" : "finalized")
                    : state.status === "READY_TO_END"
                      ? "waiting on parties"
                      : "coordinating";
              const mediatorNode = (
                <>
                  <div className={`p-avatar mediator ${Date.now() < flashUntil ? "flash" : ""} ${state.mediator_timer?.status === "running" || mediatorTriggering ? "bot-thinking" : ""}`}>W</div>
                  <div className="p-meta">
                    <span className="p-name">Mediator</span>
                    <span className={`p-status ${mediatorTriggerError ? "error" : ""}`} title={mediatorTriggerError || undefined}>
                      {mediatorStatus}
                    </span>
                    {debugMode && state.mediator_timer ? (
                      <MediatorProgressBar timer={state.mediator_timer} />
                    ) : null}
                  </div>
                </>
              );
              return debugMode || testMode ? (
                <button
                  type="button"
                  className="p-node p-node-button mediator-trigger"
                  data-testid="force-mediator-cycle"
                  onClick={() => void handleMediatorTrigger()}
                  disabled={mediatorTriggering}
                  title={testMode ? "Test mode: run the mediator immediately" : "Dev mode: run the mediator immediately"}
                >
                  {mediatorNode}
                </button>
              ) : (
                <div className="p-node">{mediatorNode}</div>
              );
            })()}
            <PhaseRail
              state={state}
              suggesting={phaseSuggesting}
              onSuggestAdvance={handlePhaseSuggestAdvance}
            />
            {phaseSuggestError ? (
              <span className="phase-error" title={phaseSuggestError}>
                {phaseSuggestError}
              </span>
            ) : null}
            {state.status !== "COMPLETED" ? (
              <button
                type="button"
                className="end-early-btn presence-end-early"
                onClick={() => setEndEarlyConfirmOpen(true)}
                disabled={endingEarly}
                title="Close the session now and export the current state"
              >
                {endingEarly ? "Ending..." : "End early"}
              </button>
            ) : null}
          </div>
        </div>
        <div className="mediation-grid">
          <TopicRail
            state={state}
            onReply={startReply}
            onAcceptPackage={handleAcceptPackage}
            onMarkReady={markReady}
            sessionId={sessionId}
            participantId={participantId}
          />
          <main className="chat">
            <div className="chat-head">
              <div>
                <div className="chat-title">Private Advocate Chat</div>
                {state.session_name ? <div className="chat-subtitle">{state.session_name}</div> : null}
              </div>
              <div className="chat-head-badges">
                <div className="chat-badge">Visible only to you</div>
                {state.status === "READY_TO_END" ? <div className="chat-badge ready">Ready to close</div> : null}
                {earlyEnded ? <div className="chat-badge early">Ended early</div> : null}
                {state.status === "COMPLETED" && !earlyEnded ? <div className="chat-badge complete">Final State Reached</div> : null}
              </div>
            </div>
            <div className="chat-messages" ref={messagesRef}>
              {combinedMessages.length ? (
                combinedMessages.map((item) => (
                  <ChatMessage
                    key={item.renderKey}
                    role={item.role}
                    text={item.text}
                    ts={item.ts}
                    error={item.error}
                    spans={item.role === "user" ? redactionHighlights[item.id] : undefined}
                    protection={
                      item.role === "user" ? redactionMessageProtections[item.id] : undefined
                    }
                    provenanceLabel={item.provenanceLabel}
                    replyTitle={item.replyTitle}
                    onOpenProtection={openProtectedItemsPanel}
                  />
                ))
              ) : (
                <ChatMessage
                  role="assistant"
                  text="Your advocate is getting ready…"
                  ts={new Date().toISOString()}
                />
              )}
              {botStatusChip ? <ChatStatusChip status={botStatusChip} /> : null}
              {state.status === "READY_TO_END" ? (() => {
                const self = state.participants.find((p) => p.id === state.participant_id);
                const selfReady = self?.ready_to_end ?? false;
                const othersNotReady = state.participants.filter(
                  (p) => p.id !== state.participant_id && !p.ready_to_end,
                );
                const waitingNames = othersNotReady.map((p) => p.display_name).join(", ");
                return (
                  <div className="ready-banner">
                    <div className="ready-banner-text">
                      {selfReady
                        ? (waitingNames
                            ? `Waiting for ${waitingNames} to close the session.`
                            : "Waiting for the other participant(s) to close the session.")
                        : closingWithPartialWorkbench
                          ? "The current partial output is ready to close. Unresolved topics stay marked partial. Press Close when you're ready; the session only fully closes once everyone has."
                          : "Everything's been resolved. Review the full agreement, then press Close when you're ready. The session only fully closes once everyone has."}
                    </div>
                    <ul className="ready-banner-roster">
                      {state.participants.map((p) => {
                        const s = closeStatus(p);
                        return (
                          <li key={p.id} className={`ready-roster-row ${s.kind}`}>
                            <span className="ready-roster-name">
                              {p.display_name}{p.id === state.participant_id ? " (you)" : ""}
                            </span>
                            <span className="ready-roster-status">{s.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="ready-banner-actions">
                      <button
                        type="button"
                        className="ready-banner-review"
                        onClick={() => { void downloadArtifact(state); }}
                      >
                        Export PDF
                      </button>
                      <button
                        type="button"
                        className="btn primary ready-banner-btn"
                        data-testid="ready-close"
                        onClick={() => markReady()}
                        disabled={selfReady}
                      >
                        {selfReady ? "Waiting..." : "Close"}
                      </button>
                    </div>
                  </div>
                );
              })() : null}
              {state.status === "COMPLETED" ? (
                <div className="session-close-summary">
                  <div className={`final-banner${earlyEnded ? " early" : ""}`}>
                    <div className="final-banner-text">
                      {earlyEnded
                        ? "This session was ended early. The output records the current state; unresolved topics are not final agreements."
                        : "The mediation has reached a final state. Review the output document for the final agreements."}
                    </div>
                    <div className="final-banner-actions">
                      <button type="button" className="btn" onClick={() => { void handleCopySharedOutcome(); }}>
                        {sharedOutcomeCopied ? "Link copied" : "Copy outcome link"}
                      </button>
                      <button type="button" className="btn" onClick={() => { void downloadArtifact(state); }}>
                        {earlyEnded ? "Export current PDF" : "Export output PDF"}
                      </button>
                    </div>
                  </div>
                  <SessionTakeawaysPanel state={state} />
                </div>
              ) : null}
            </div>
            <div className="composer">
              {debugMode && (
                <div className="dev-autofill-bar">
                  <span className="dev-autofill-tag" title="Visible only in dev mode">DEV</span>
                  <button
                    type="button"
                    className="dev-autofill-btn"
                    onClick={() => void handleAutofill()}
                    disabled={autofilling || state.status === "COMPLETED"}
                    title="Suggest this party's next reply from the conversation so far (light model). You can edit before sending."
                  >
                    {autofilling ? "Thinking…" : "⤵ Autofill reply"}
                  </button>
                  <button
                    type="button"
                    className={`dev-autofill-btn${persona.trim() ? " is-active" : ""}`}
                    onClick={() => setPersonaOpen((v) => !v)}
                    title="Pin a personality / behaviour for the autofilled party (e.g. never concede)"
                  >
                    {persona.trim() ? "● Personality" : "Personality"}
                  </button>
                  <button
                    type="button"
                    className="dev-autofill-btn"
                    onClick={() => void handleCopyChipTrace()}
                    title="Copy the dev-only chat status interval trace for this participant"
                    disabled={!sessionId || !participantId}
                  >
                    {chipTraceCopied ? "Trace copied" : "Copy chip trace"}
                  </button>
                  {autofillError && (
                    <span className="dev-autofill-error" title={autofillError}>{autofillError}</span>
                  )}
                  {personaOpen && (
                    <div className="dev-persona-popover">
                      <div className="dev-persona-head">
                        <strong>Personality to play</strong>
                        <button
                          type="button"
                          className="dev-persona-close"
                          onClick={() => setPersonaOpen(false)}
                          aria-label="Close"
                        >
                          {"✕"}
                        </button>
                      </div>
                      <p className="dev-persona-hint">
                        How should this party behave when autofilled? e.g. <em>"Never
                        concede on price. Keep changing your number. Ask a tangent
                        every other turn."</em> Saved per-side in this browser.
                      </p>
                      <textarea
                        className="dev-persona-textarea"
                        value={persona}
                        onChange={(event) => savePersona(event.target.value)}
                        placeholder="Leave blank for a neutral, realistic party…"
                        rows={5}
                      />
                      <div className="dev-persona-foot">
                        <button
                          type="button"
                          className="dev-persona-clear"
                          onClick={() => savePersona("")}
                          disabled={!persona.trim()}
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          className="dev-persona-done"
                          onClick={() => setPersonaOpen(false)}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {replyingTo && (
                <div className={`composer-reply-chip${replyTargetStale ? " stale" : ""}`}>
                  <span className="composer-reply-label">
                    {replyTargetStale ? "Updated since you opened this" : "Replying to"}
                  </span>
                  <span className="composer-reply-title">{replyingTo.title}</span>
                  {replyTargetStale ? (
                    <button
                      type="button"
                      className="composer-reply-update"
                      onClick={useLatestReplyTarget}
                    >
                      Use latest
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="composer-reply-cancel"
                    onClick={() => setReplyingTo(null)}
                    aria-label="Cancel reply"
                  >
                    {"\u2715"}
                  </button>
                </div>
              )}
              <div className="composer-row">
                <textarea
                  ref={textareaRef}
                  value={message}
                  rows={1}
                  onChange={(event) => { setMessage(event.target.value); autoResize(); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={state.status === "COMPLETED" ? (earlyEnded ? "Session ended early. Chat closed." : "Session complete. Chat closed.") : "Share constraints, priorities, or proposed trades..."}
                  disabled={state.status === "COMPLETED"}
                />
                <button
                  className="btn primary"
                  disabled={sending || state.status === "COMPLETED"}
                  onClick={handleSend}
                >
                  {state.status === "COMPLETED" ? "Closed" : sending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}
