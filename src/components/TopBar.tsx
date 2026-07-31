import { useEffect, useState } from "react";
import { useAppStore } from "../store";
import { Tooltip } from "./Tooltip";

export function TopBar() {
  const page = useAppStore((state) => state.page);
  const sessionId = useAppStore((state) => state.sessionId);
  const health = useAppStore((state) => state.health);
  const copySessionCode = useAppStore((state) => state.copySessionCode);
  const copySessionLink = useAppStore((state) => state.copySessionLink);
  const openInspector = useAppStore((state) => state.openInspector);
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!linkCopied) return;
    const timer = window.setTimeout(() => setLinkCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [linkCopied]);

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">W</div>
        Wediate
      </div>
      <div className="session-tools">
        {page === "session" && sessionId ? (
          <div className="session-share-controls" aria-label="Session sharing">
            <Tooltip content={copied ? "Invite code copied" : "Copy invite code"} side="bottom" align="start">
              <button
                type="button"
                className={`session-pill session-pill-copy ${copied ? "success" : ""}`}
                aria-label={`Copy invite code ${sessionId}`}
                onClick={async () => {
                  await copySessionCode();
                  setCopied(true);
                }}
              >
                <span className="session-pill-label">Session code</span>
                <span className="session-pill-code">{sessionId}</span>
                <span className="session-copy-glyph" aria-hidden="true">
                  {copied ? "copied" : "⧉"}
                </span>
              </button>
            </Tooltip>
            <Tooltip content={linkCopied ? "Invite link copied" : "Copy invite link"} side="bottom" align="start">
              <button
                type="button"
                className={`session-link-copy ${linkCopied ? "success" : ""}`}
                aria-label="Copy invite link"
                onClick={async () => {
                  await copySessionLink();
                  setLinkCopied(true);
                }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M6.2 9.8 9.8 6.2" />
                  <path d="M5.1 11.7 3.8 13a2.5 2.5 0 0 1-3.5-3.5l2.8-2.8a2.5 2.5 0 0 1 3.5 0" />
                  <path d="m10.9 4.3 1.3-1.3a2.5 2.5 0 0 1 3.5 3.5l-2.8 2.8a2.5 2.5 0 0 1-3.5 0" />
                </svg>
                <span>{linkCopied ? "Copied" : "Copy link"}</span>
              </button>
            </Tooltip>
          </div>
        ) : null}
      </div>
      <div className="top-actions">
        <Tooltip
          content={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          side="bottom"
          align="end"
        >
        <button
          className="icon-btn theme-toggle"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={theme === "dark"}
          onClick={toggleTheme}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
        </Tooltip>
        {health?.dev_mode === "1" ? (
          <button className="btn secondary" onClick={() => void openInspector()}>
            Mediator Inspector
          </button>
        ) : null}
      </div>
    </header>
  );
}
