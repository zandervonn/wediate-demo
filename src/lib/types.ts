export type TopicState = "GATHERING" | "PROPOSED" | "PARTIAL" | "RESOLVED";
export type TopicActivity = "active" | "waiting" | "parked";
export type MediationPhase = "MAPPING" | "CONVERGENCE" | "SYNTHESIS";
export type DraftStatus = "NONE" | "WORKING" | "REVIEW" | "ACCEPTED";
export type DirectiveType =
  | "GATHER_INFO"
  | "FLOW_DIRECTIVE"
  | "REALITY_CHECK"
  | "CONFIRM_STATE"
  | "SYNTHESIS_UPDATE"
  | "FAIRNESS_CONTEXT"
  | "DISCLOSURE_REQUEST"
  | "BOT_RESPONSE";
export type DirectiveActionExpected =
  | "status_only"
  | "ask_private_refinement"
  | "wait_or_move_topic"
  | "narrow_delta_check"
  | "confirm_package";

export type DisclosureLevel = "SEALED" | "ANONYMIZED" | "TRANSPARENT";
export type ResolutionStrictness = "open" | "strict";

export interface Participant {
  id: string;
  display_name: string;
  joined_at: string;
  last_active_at: string;
  is_typing: boolean;
  is_waiting?: boolean;
  ready_to_end: boolean;
  ready_recommendation_id?: string | null;
  ready_outcome_revision?: string | null;
  bot_busy?: boolean;
  last_message_at?: string | null;
}

export interface PhaseSuggestion {
  participant_id: string;
  display_name: string;
  from_phase: MediationPhase;
  target_phase: MediationPhase;
  created_at: string;
}

export interface TopicView {
  id: string;
  name: string;
  state: TopicState;
  activity?: TopicActivity;
  draft_status: DraftStatus;
  working_draft: string;
  proposal_summary?: string;
  proposal_group_id?: string | null;
  proposal_topic_ids?: string[];
  proposal_snapshot_hash?: string;
  visible_snapshot_hashes?: Record<string, string>;
  accepted_snapshot_hashes?: Record<string, string>;
  accepted_workbench_ids?: Record<string, string>;
  accepted_workbench_revisions?: Record<string, number>;
  acceptance: Record<string, "accepted" | "rejected" | "pending">;
  visible_surface_id?: string | null;
  shared_snapshot?: {
    id: string;
    revision: number;
    text: string;
    updated_at: string;
    topic_revision: number;
  } | null;
  /** Canonical participant-visible projection; shared_snapshot is a legacy alias. */
  workbench?: {
    id: string;
    revision: number;
    text: string;
    updated_at: string;
    topic_revision: number;
  } | null;
  frontier_question?: {
    id: string;
    session_id: string;
    topic_id: string;
    participant_id: string;
    question: string;
    status: "open" | "answered" | "superseded";
    source_cycle?: number | null;
    created_at: string;
    updated_at: string;
  } | null;
}

export type SurfaceKind = "chat" | "setup" | "topic_status" | "proposal" | "artifact_status";
export type SurfaceAuthorRole = "user" | "advocate" | "system";
export type ReplyLinkKind = "explicit" | "inferred" | "none";

export interface DeliveredSurface {
  id: string;
  session_seq: number;
  session_id: string;
  recipient_id: string;
  author_role: SurfaceAuthorRole;
  surface_kind: SurfaceKind;
  exact_text: string;
  source_type: string;
  source_id: string;
  reply_to_surface_id?: string | null;
  reply_link_kind: ReplyLinkKind;
  source_move_ids: string[];
  topic_ids: string[];
  proposal_snapshot_hash: string;
  delivery_group_id?: string | null;
  committed_at: string;
}

export interface ParticipantView {
  participant_id: string;
  surfaces: DeliveredSurface[];
  topics: TopicView[];
  artifact: Artifact;
}

export interface BotEntry {
  id: string;
  session_id: string;
  participant_id: string;
  entry_type: string;
  content: string;
  topic_id: string | null;
  created_at: string;
}

export interface Directive {
  id: string;
  session_id: string;
  target_participant_id: string;
  directive_type: DirectiveType;
  content: string;
  created_at: string;
  delivered: boolean;
  reason_code: string;
  action_expected?: DirectiveActionExpected | null;
}

export interface ArtifactSection {
  id: string;
  topic_id: string;
  topic_decision_id: string;
  title: string;
  text: string;
  evidence_status: string;
  draft_status: DraftStatus;
  supersedes_section_ids?: string[];
  superseded_by_section_id?: string | null;
  superseded_at?: string | null;
  updated_at: string;
}

export interface Artifact {
  version: number;
  sections: ArtifactSection[];
  unresolved_topic_ids: string[];
  updated_at: string;
}

export interface SharedOutcomeSection {
  topic_id: string;
  title: string;
  status: string;
  text: string;
}

export interface SharedOutcome {
  session_id: string;
  session_name: string;
  output_type: string;
  close_mode: "normal" | "early";
  closed_at?: string | null;
  sections: SharedOutcomeSection[];
  takeaways: {
    pace: string;
    convergence: string;
    closure: string;
  };
}

export interface MediatorTimerState {
  status: "idle" | "waiting" | "running";
  seconds_remaining: number;
}

export interface SessionState {
  session_id: string;
  participant_id: string;
  session_name: string;
  status: "ACTIVE" | "READY_TO_END" | "COMPLETED";
  close_mode?: "normal" | "early";
  closed_at?: string | null;
  closed_by_participant_id?: string | null;
  productive_close?: {
    status: "inactive" | "recommended" | "retracted";
    recommendation_id?: string | null;
    outcome_revision?: string | null;
    participant_safe_reason: string;
    unresolved_topic_ids: string[];
    recommended_at?: string | null;
    retracted_at?: string | null;
    retraction_reason: string;
    new_productive_path: string;
  };
  output_type: string;
  welcome_message: string;
  mediation_phase?: MediationPhase;
  phase_updated_at?: string | null;
  phase_suggestions?: PhaseSuggestion[];
  participants: Participant[];
  topics: TopicView[];
  my_entries: BotEntry[];
  my_directives: Directive[];
  pending_directives: Directive[];
  artifact: Artifact;
  mediator_log: string[];
  session_takeaways?: {
    pace: string;
    convergence: string;
    closure: string;
  };
  mediator_timer?: MediatorTimerState;
  liveness_blocker?: string | null;
  participant_view?: ParticipantView | null;
  disclosure_requests?: DisclosureRequest[];
}

export type DisclosureRequestStatus = "pending" | "accepted" | "declined" | "superseded";

export interface DisclosureRequest {
  id: string;
  session_id: string;
  owner_participant_id: string;
  source_proposition: string;
  source_phrase_keys: string[];
  willingness_quote: string;
  exact_statement: string;
  audience_participant_ids: string[];
  blocked_outcome: string;
  necessity: string;
  remains_private: string;
  decline_fallback: string;
  topic_id?: string | null;
  source_directive_id?: string | null;
  status: DisclosureRequestStatus;
  created_at: string;
  decided_at?: string | null;
  grant_id?: string | null;
  delivered_recipient_ids: string[];
}

export type JoinerAck = "agreed" | "flagged" | "silent";

export interface CreateSessionRequest {
  display_name: string;
  session_name?: string;
  description?: string;
  pre_agreements?: string;
  participant_context?: string;
  roster?: Array<string | { name: string; note?: string }>;
  output_type: string;
  topics: string[];
  expected_participants?: number | null;
  enforce_participant_cap?: boolean;
  disclosure_policy?: { level: DisclosureLevel };
  resolution_strictness?: ResolutionStrictness;
  timezone?: string | null;
}

export interface CreateSessionResponse {
  session_id: string;
  participant_id: string;
}

export interface JoinSessionResponse {
  participant_id: string;
}

export interface RosterSlotPreview {
  id: string;
  name: string;
  note: string;
  claimed: boolean;
}

export interface SessionPreview {
  session_id: string;
  session_name: string;
  description: string;
  pre_agreements: string;
  participant_context: string;
  roster: RosterSlotPreview[];
  disclosure_level: DisclosureLevel;
  resolution_strictness: ResolutionStrictness;
  expected_participants: number | null;
  enforce_participant_cap: boolean;
  participant_count: number;
  capacity_reached: boolean;
}

export interface HealthResponse {
  status: string;
  provider: string;
  app_env?: string;
  wediate_env?: string;
  dev_mode: string;
  test_mode: string;
}

export interface StreamEvent {
  type: "thinking" | "token" | "final" | "processing" | "done" | "error";
  content?: string;
  step?: string;
  surface_id?: string;
}

export type ProtectedItemGroup = "amounts" | "timing" | "named" | "other";

export interface ProtectedItem {
  label: string;
  variants: string[];
  count: number;
  cluster_id: number;
  authorized: boolean;
  group: ProtectedItemGroup;
  topic_id: string | null;
  topic_name: string | null;
  structured_item_id?: string;
  classification_state?: "protected" | "public_example" | "fallback_protected";
  source_texts?: string[];
  typed_atoms?: Array<{ surface: string; kind: string; unit: string; role: string }>;
  /**
   * Internal held-item progress signal: present when this private item's
   * load-bearing tokens were repeatedly held by the disclosure gate.
   * Owner-only telemetry; the MMVP UI does not render it as a call to share.
   */
  blocking_progress?: {
    blocked_cycles: number;
    last_blocked_at: string | null;
  } | null;
}

export interface ProtectedCategory {
  id: number;
  /** Seed label — the phrase that first created the concept. */
  label: string;
  /**
   * v7: live-medoid label pre-auth, locked snapshot post-auth.
   * The UI should render this rather than `label` so the heading
   * tracks the cluster's current shape until the user authorises.
   */
  effective_label?: string;
  /** Non-null once the user authorised; UI shows lock indicator. */
  locked_label?: string | null;
  /** ISO timestamp of authorisation; null when unauthorised. */
  authorized_at?: string | null;
  cluster_ids: number[];
  /**
   * v7: cluster ids in this category whose phrases ALSO belong to
   * another category. Used to render the multi-parent badge.
   */
  multi_parent_cluster_ids?: number[];
  authorized: boolean;
}

export interface ProtectedDisplayGroup {
  id: string;
  label: string;
  cluster_ids: number[];
  topic_id: string | null;
  topic_name: string | null;
}

export interface ProtectedItemsResponse {
  items: ProtectedItem[];
  categories?: ProtectedCategory[];
  display_groups?: ProtectedDisplayGroup[];
}

/**
 * A read-only highlight span for one of the participant's own chat messages.
 * Offsets are character indices into the raw message text. `cluster_id`
 * matches a protection-panel chicklet so the highlight colour tracks the
 * list; `authorized` flips the span from protected (red) to shared (green).
 */
export interface RedactionHighlightSpan {
  start: number;
  end: number;
  cluster_id: number;
  authorized: boolean;
}

export interface RedactionMessageProtection {
  cluster_ids: number[];
  authorized: boolean;
}

export interface RedactionHighlightsResponse {
  /** Keyed by message (entry) id → spans within that message. */
  highlights: Record<string, RedactionHighlightSpan[]>;
  messages?: Record<string, RedactionMessageProtection>;
}
