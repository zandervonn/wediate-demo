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

  getProtectedItems: async (..._args: unknown[]) => ({
    items: [],
    display_groups: [],
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
