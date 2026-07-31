import { create } from "zustand";
import type {
  DisclosureLevel,
  RedactionHighlightSpan,
  RedactionMessageProtection,
  SessionState,
} from "./lib/types";

type MockPage = "lobby" | "session";

type LobbyRosterEntry = { name: string; note: string };

type LobbyDraft = {
  displayName: string;
  description: string;
  preAgreements: string;
  roster: LobbyRosterEntry[];
  disclosure: DisclosureLevel;
  enforceParticipantCap: boolean;
  joinCode: string;
};

type MockStore = {
  page: MockPage;
  theme: "light" | "dark";
  sessionId: string;
  participantId: string;
  health: {
    dev_mode: string;
    test_mode: string;
    app_env: string;
    wediate_env: string;
  };
  lobby: LobbyDraft;
  loading: boolean;
  sessionState: SessionState | null;
  draftMessages: any[];
  sending: boolean;
  mediatorFlashUntil: number;
  lastStateRefreshAt: number | null;
  redactionHighlights: Record<string, RedactionHighlightSpan[]>;
  redactionMessageProtections: Record<string, RedactionMessageProtection>;
  pendingDisclosures: Record<number, { label: string; locked: boolean }>;
  setPage: (page: MockPage) => void;
  setLobby: (patch: Partial<LobbyDraft>) => void;
  createSession: () => Promise<void>;
  startJoin: () => Promise<void>;
  toggleTheme: () => void;
  refreshState: () => Promise<void>;
  refreshHighlights: () => Promise<void>;
  sendMessage: (...args: any[]) => Promise<boolean>;
  acceptPackage: (...args: any[]) => Promise<void>;
  markReady: (...args: any[]) => Promise<void>;
  endSessionEarly: (...args: any[]) => Promise<void>;
  copySessionCode: (...args: any[]) => Promise<void>;
  copySessionLink: (...args: any[]) => Promise<void>;
  openInspector: (...args: any[]) => Promise<void>;
  togglePendingDisclosure: (...args: any[]) => void;
  clearPendingDisclosures: (...args: any[]) => void;
};

export const useAppStore = create<MockStore>((set) => ({
  page: "session",
  theme: "light",
  sessionId: "preview-01",
  participantId: "preview-you",
  health: {
    dev_mode: "0",
    test_mode: "0",
    app_env: "public-demo",
    wediate_env: "public-demo",
  },
  lobby: {
    displayName: "Alex",
    description: "Work out launch support coverage and the first owner for the rotation.",
    preAgreements: "Keep the launch date under review.",
    roster: [
      { name: "Alex", note: "Product lead" },
      { name: "Jordan", note: "Support partner" },
    ],
    disclosure: "ANONYMIZED",
    enforceParticipantCap: true,
    joinCode: "",
  },
  loading: false,
  sessionState: null,
  draftMessages: [],
  sending: false,
  mediatorFlashUntil: 0,
  lastStateRefreshAt: null,
  redactionHighlights: {},
  redactionMessageProtections: {},
  pendingDisclosures: {},
  setPage: (page) => set({ page }),
  setLobby: (patch) => set((state) => ({ lobby: { ...state.lobby, ...patch } })),
  createSession: async () => set({ page: "session" }),
  startJoin: async () => set({ page: "session" }),
  toggleTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
  refreshState: async () => undefined,
  refreshHighlights: async () => undefined,
  sendMessage: async () => false,
  acceptPackage: async () => undefined,
  markReady: async () => undefined,
  endSessionEarly: async () => undefined,
  copySessionCode: async () => undefined,
  copySessionLink: async () => undefined,
  openInspector: async () => undefined,
  togglePendingDisclosure: (clusterId, label) => set((state) => ({
    pendingDisclosures: {
      ...state.pendingDisclosures,
      [clusterId]: { label, locked: false },
    },
  })),
  clearPendingDisclosures: (clusterIds) => set((state) => {
    const pending = { ...state.pendingDisclosures };
    for (const clusterId of clusterIds) delete pending[clusterId];
    return { pendingDisclosures: pending };
  }),
}));

export function buildSharedOutcomeUrl(sessionId: string): string {
  if (typeof window === "undefined") return `#mock-outcome-${sessionId}`;
  return `${window.location.origin}${window.location.pathname}#mock-outcome-${encodeURIComponent(sessionId)}`;
}
