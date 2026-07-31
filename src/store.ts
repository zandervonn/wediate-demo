import { create } from "zustand";
import type {
  RedactionHighlightSpan,
  RedactionMessageProtection,
  SessionState,
} from "./lib/types";

type MockPage = "lobby" | "session";

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
  sessionState: SessionState | null;
  draftMessages: any[];
  sending: boolean;
  mediatorFlashUntil: number;
  lastStateRefreshAt: number | null;
  redactionHighlights: Record<string, RedactionHighlightSpan[]>;
  redactionMessageProtections: Record<string, RedactionMessageProtection>;
  pendingDisclosures: Record<number, { label: string; locked: boolean }>;
  setPage: (page: MockPage) => void;
  toggleTheme: () => void;
  refreshState: () => Promise<void>;
  refreshHighlights: () => Promise<void>;
  sendMessage: (...args: any[]) => Promise<boolean>;
  acceptPackage: (...args: any[]) => Promise<void>;
  decideDisclosureRequest: (...args: any[]) => Promise<void>;
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
  sessionId: "mock-01",
  participantId: "mock-you",
  health: {
    dev_mode: "0",
    test_mode: "0",
    app_env: "public-demo",
    wediate_env: "public-demo",
  },
  sessionState: null,
  draftMessages: [],
  sending: false,
  mediatorFlashUntil: 0,
  lastStateRefreshAt: null,
  redactionHighlights: {},
  redactionMessageProtections: {},
  pendingDisclosures: {},
  setPage: (page) => set({ page }),
  toggleTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
  refreshState: async () => undefined,
  refreshHighlights: async () => undefined,
  sendMessage: async () => false,
  acceptPackage: async () => undefined,
  decideDisclosureRequest: async () => undefined,
  markReady: async () => undefined,
  endSessionEarly: async () => undefined,
  copySessionCode: async () => undefined,
  copySessionLink: async () => undefined,
  openInspector: async () => undefined,
  togglePendingDisclosure: () => undefined,
  clearPendingDisclosures: () => undefined,
}));

export function buildSharedOutcomeUrl(sessionId: string): string {
  if (typeof window === "undefined") return `#mock-outcome-${sessionId}`;
  return `${window.location.origin}${window.location.pathname}#mock-outcome-${encodeURIComponent(sessionId)}`;
}
