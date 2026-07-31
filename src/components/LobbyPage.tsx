import { useState } from "react";
import { useAppStore } from "../store";
import type { DisclosureLevel } from "../lib/types";

// [DisclosureLevel, tint class, display label, designed description]
const disclosureOptions: Array<[DisclosureLevel, string, string, string]> = [
  ["SEALED", "sealed", "Sealed", "Others learn that progress is happening — never what you said."],
  ["ANONYMIZED", "balanced", "Balanced", "Themes and directions are shared. Your words and numbers stay private until you approve."],
  ["TRANSPARENT", "open", "Open", "Everyone sees everything. Best when trust is high and speed matters most."],
];

const disclosureLabel: Record<DisclosureLevel, string> = {
  SEALED: "Sealed",
  ANONYMIZED: "Balanced",
  TRANSPARENT: "Open",
};

export function LobbyPage() {
  const lobby = useAppStore((state) => state.lobby);
  const setLobby = useAppStore((state) => state.setLobby);
  const createSession = useAppStore((state) => state.createSession);
  const startJoin = useAppStore((state) => state.startJoin);
  const loading = useAppStore((state) => state.loading);
  const [creating, setCreating] = useState(false);
  const [agreementsOpen, setAgreementsOpen] = useState(Boolean(lobby.preAgreements.trim()));

  const handleCreate = () => {
    setCreating(true);
    void createSession();
  };

  const updateRosterNameAt = (index: number, value: string) => {
    const next = [...lobby.roster];
    next[index] = { ...next[index], name: value };
    setLobby(index === 0 ? { roster: next, displayName: value } : { roster: next });
  };
  const updateRosterNoteAt = (index: number, value: string) => {
    const next = [...lobby.roster];
    next[index] = { ...next[index], note: value };
    setLobby({ roster: next });
  };
  const addRosterRow = () => setLobby({ roster: [...lobby.roster, { name: "", note: "" }] });
  const removeRosterRow = (index: number) => {
    const next = lobby.roster.filter((_, i) => i !== index);
    setLobby({ roster: next.length ? next : [{ name: "", note: "" }] });
  };

  const participantCount = lobby.roster.length;
  const privacyLabel = disclosureLabel[lobby.disclosure];

  return (
    <section className="page active">
      {creating && loading && (
        <div className="lobby-loading-overlay" role="status" aria-live="polite">
          <div className="lobby-loading-card">
            <span className="btn-spinner large" aria-hidden="true" />
            <div className="lobby-loading-text">Setting up your session...</div>
          </div>
        </div>
      )}

      <div className="lobby-create">
        <h1 className="lead">Build agreement with <em>structure</em>, not noise.</h1>
        <p className="lead-sub">
          Start a new session — three short steps. You can change everything once you're inside.
        </p>

        {/* Join: quiet secondary shelf, clearly below the title. */}
        <div className="join-inline">
          <div className="join-l">
            <b>Joining instead?</b>
            <span>Enter your invite code — you'll pick who you are next.</span>
          </div>
          <div className="join-r">
            <input
              value={lobby.joinCode}
              placeholder="ses_xxx####"
              aria-label="Invite code"
              onChange={(e) => setLobby({ joinCode: e.target.value })}
            />
            <button className="btn with-spinner" disabled={loading} onClick={() => void startJoin()}>
              {loading ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  Joining...
                </>
              ) : (
                "Review & join"
              )}
            </button>
          </div>
        </div>

        <div className="lobby-grid">
          {/* FORM */}
          <div className="panel form">
            {/* STEP 1 — what you're resolving */}
            <section className="step">
              <div className="step-head">
                <span className="step-num">1</span>
                <span className="step-title">What you're resolving</span>
              </div>
              <div className="field">
                <label>The decision or disagreement</label>
                <div className="help">A sentence or two. Shown to all participants.</div>
                <textarea
                  value={lobby.description}
                  placeholder="e.g. Dissolving NewCo — splitting equity, IP, and customer accounts between three co-founders."
                  onChange={(e) => setLobby({ description: e.target.value })}
                />
              </div>
              <details
                className="agree"
                open={agreementsOpen}
                onToggle={(e) => setAgreementsOpen(e.currentTarget.open)}
              >
                <summary>
                  <span className="dl">What do you already agree on?</span>
                  <span className="opt">Optional</span>
                </summary>
                <div className="field" style={{ marginTop: 8 }}>
                  <div className="help">Shared ground to start from. Shown to all participants.</div>
                  <textarea
                    style={{ minHeight: 64 }}
                    value={lobby.preAgreements}
                    placeholder="e.g. The company is winding down, and salaries owed are paid first."
                    onChange={(e) => setLobby({ preAgreements: e.target.value })}
                  />
                </div>
              </details>
            </section>

            {/* STEP 2 — privacy (hero) */}
            <section className="step">
              <div className="step-head">
                <span className="step-num">2</span>
                <span className="step-title">
                  Privacy<span className="opt">how much the mediator shares</span>
                </span>
              </div>
              <div className="priv-grid">
                {disclosureOptions.map(([value, tint, label, description]) => (
                  <button
                    key={value}
                    type="button"
                    className={`priv ${tint} ${lobby.disclosure === value ? "on" : ""}`}
                    aria-pressed={lobby.disclosure === value}
                    onClick={() => setLobby({ disclosure: value })}
                  >
                    <div className="ph">
                      <span className="dot" />
                      <span className="pn">{label}</span>
                    </div>
                    <div className="pd">{description}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* STEP 3 — participants */}
            <section className="step">
              <div className="step-head">
                <span className="step-num">3</span>
                <span className="step-title">Participants</span>
              </div>

              <div className="field">
                <label>Session size</label>
                <div className="help">
                  By default, only the participant rows below can join.
                </div>
              </div>

              <div className="r-label">Who's in the room</div>
              <div className="roster">
                {lobby.roster.map((participant, index) => (
                  <div className="r-row" key={index}>
                    <div className="r-main">
                      <div className="r-f">
                        <span className="r-fl">{index === 0 ? "Participant (you)" : "Participant"}</span>
                        <input
                          value={participant.name}
                          placeholder={index === 0 ? "Your name" : `Participant ${index + 1} name`}
                          onChange={(e) => updateRosterNameAt(index, e.target.value)}
                        />
                      </div>
                      <div className="r-f">
                        <span className="r-fl">Notes</span>
                        <input
                          value={participant.note}
                          placeholder="Optional note, role, or context"
                          onChange={(e) => updateRosterNoteAt(index, e.target.value)}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`r-rm ${index === 0 ? "hidden" : ""}`}
                      aria-label={`Remove participant ${index + 1}`}
                      onClick={() => removeRosterRow(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="r-add" style={{ marginTop: 8 }} onClick={addRosterRow}>
                + Add participant
              </button>

              <button
                type="button"
                className={`open-ended-toggle ${!lobby.enforceParticipantCap ? "on" : ""}`}
                aria-pressed={!lobby.enforceParticipantCap}
                onClick={() => setLobby({ enforceParticipantCap: !lobby.enforceParticipantCap })}
              >
                <span className="open-ended-check" aria-hidden="true" />
                <span>
                  <span className="open-ended-title">Open-ended session</span>
                  <span className="open-ended-desc">
                    Allow extra people to join even if they are not listed above.
                  </span>
                </span>
              </button>
            </section>

            <div className="action">
              <div className="meta">
                <b>{participantCount} participant{participantCount === 1 ? "" : "s"}</b> · {privacyLabel} privacy
                <div className="meta-note">Everything here — names, title, and details — is shown to everyone who joins.</div>
              </div>
              <button className="btn primary with-spinner" disabled={loading} onClick={handleCreate}>
                {loading ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create &amp; enter <span className="action-arrow">→</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT RAIL */}
          <aside className="aside">
            <div className="panel join-panel">
              <div className="join-l">
                <h3>Joining instead?</h3>
                <span>Enter your invite code. You'll pick who you are next.</span>
              </div>
              <div className="join-r">
                <input
                  value={lobby.joinCode}
                  placeholder="ses_xxx####"
                  aria-label="Invite code"
                  onChange={(e) => setLobby({ joinCode: e.target.value })}
                />
                <button className="btn with-spinner" disabled={loading} onClick={() => void startJoin()}>
                  {loading ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true" />
                      Joining...
                    </>
                  ) : (
                    "Review & join"
                  )}
                </button>
              </div>
            </div>
            <div className="panel">
              <h3>How it works</h3>
              <ul className="how">
                <li>
                  <span className="n">01</span>
                  <span><strong>Create a session</strong> and share the invite code with the other participants.</span>
                </li>
                <li>
                  <span className="n">02</span>
                  <span><strong>Each person gets a private advocate</strong> — an AI that listens, pushes back, and helps you say what you actually want.</span>
                </li>
                <li>
                  <span className="n">03</span>
                  <span><strong>An active, neutral mediator</strong> evaluates the options and recommends fair, workable ways forward. You still decide what you do and agree to.</span>
                </li>
                <li>
                  <span className="n">04</span>
                  <span><strong>An output document builds as you go.</strong> Your own chat stays private — others never see it.</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
