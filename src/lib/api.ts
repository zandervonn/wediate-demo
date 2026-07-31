import type { ProtectedDisplayGroup, ProtectedItem } from "./types";

// Public demo boundary: the portfolio build has no service client.
// These local-only helpers keep the real UI components renderable without
// exposing the production transport or making network requests.

export const api = {
  artifactPdfUrl: (sessionId: string, participantId: string) =>
    `#mock-artifact-${encodeURIComponent(sessionId)}-${encodeURIComponent(participantId)}`,

  saveArtifactPdfForDevReview: async (..._args: unknown[]) => ({
    path: "mock-artifact.pdf",
    filename: "wediate-mock-outcome.pdf",
    bytes: 0,
  }),

  getProtectedItems: async (..._args: unknown[]): Promise<{
    items: ProtectedItem[];
    display_groups: ProtectedDisplayGroup[];
  }> => ({
    items: [
      {
        label: "support capacity",
        variants: ["support capacity", "support request"],
        count: 1,
        cluster_id: 1,
        authorized: false,
        group: "other",
        topic_id: "preview-topic-1",
        topic_name: "Launch support coverage",
        source_texts: ["support capacity"],
      },
      {
        label: "two-week rotation",
        variants: ["two-week support rotation", "first two weeks"],
        count: 1,
        cluster_id: 2,
        authorized: false,
        group: "timing",
        topic_id: "preview-topic-2",
        topic_name: "Support rotation option",
        source_texts: ["two-week rotation"],
      },
    ],
    display_groups: [
      {
        id: "mock-support",
        label: "Launch support coverage",
        cluster_ids: [1, 2],
        topic_id: "preview-topic-1",
        topic_name: "Launch support coverage",
      },
    ],
  }),

  autofillReply: async (..._args: unknown[]) => ({
    suggestion: "This is a local mock response. The production advocate remains private.",
  }),

  triggerMediator: async (..._args: unknown[]) => ({
    processed_entries: 0,
    directives_created: 0,
    topics_updated: 0,
  }),

  suggestPhaseAdvance: async (..._args: unknown[]) => ({
    status: "mock",
    from_phase: "MAPPING",
    target_phase: "CONVERGENCE",
    processed_entries: 0,
    directives_created: 0,
    topics_updated: 0,
  }),
};
