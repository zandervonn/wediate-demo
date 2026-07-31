import { FormEvent, useState } from "react";
import "./DemoWorkspace.css";

type DemoMessage = {
  id: string;
  role: "you" | "advocate";
  text: string;
};

const initialMessages: DemoMessage[] = [
  {
    id: "m1",
    role: "you",
    text: "I want to keep the launch date, but I cannot quietly absorb every support request.",
  },
  {
    id: "m2",
    role: "advocate",
    text: "The date matters, and the hidden constraint is capacity. Let us make the support handoff explicit before you trade one for the other.",
  },
];

export function demoReplyFor(input: string): string {
  const message = input.toLowerCase();
  if (message.includes("support") || message.includes("handoff")) {
    return "A workable next move is to define a short support rotation, with a named owner and a review point after the first week.";
  }
  if (message.includes("date") || message.includes("launch")) {
    return "You are protecting momentum, not just a calendar date. What would need to be true for the date to stay realistic?";
  }
  if (message.includes("money") || message.includes("budget")) {
    return "Put the cost beside the trade-off. A visible limit can make the decision easier to discuss without turning it into a surprise later.";
  }
  return "The useful question is underneath the first position: what are you trying to protect, and what would make a workable compromise feel safe?";
}

type DemoWorkspaceProps = {
  onBack: () => void;
};

export function DemoWorkspace({ onBack }: DemoWorkspaceProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [shared, setShared] = useState(false);
  const [recommendationVisible, setRecommendationVisible] = useState(false);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    const userMessage: DemoMessage = {
      id: `user-${messages.length}`,
      role: "you",
      text,
    };
    const reply: DemoMessage = {
      id: `reply-${messages.length}`,
      role: "advocate",
      text: demoReplyFor(text),
    };
    setMessages((current) => [...current, userMessage, reply]);
    setDraft("");
  }

  return (
    <main className="demo-page">
      <header className="demo-header">
        <button className="demo-back" type="button" onClick={onBack}>
          ← Back to overview
        </button>
        <div className="demo-header-title">
          <span className="demo-eyebrow">Sanitized product demo</span>
          <strong>Wediate workspace</strong>
        </div>
        <span className="demo-status">offline · synthetic session</span>
      </header>

      <section className="demo-intro">
        <span className="demo-eyebrow">A small, inspectable slice</span>
        <h1>Private reflection. Visible movement.</h1>
        <p>
          This browser-only walkthrough shows the product surface without a backend, real account,
          private prompt, or live session data.
        </p>
      </section>

      <section className="demo-grid" aria-label="Wediate product walkthrough">
        <article className="demo-panel advocate-panel">
          <div className="demo-panel-heading">
            <div>
              <span className="demo-label">Your private room</span>
              <h2>Talk to your advocate</h2>
            </div>
            <span className="demo-badge private">private</span>
          </div>

          <div className="demo-chat" aria-live="polite">
            {messages.map((message) => (
              <div className={`demo-message ${message.role}`} key={message.id}>
                <span className="demo-message-role">{message.role === "you" ? "You" : "Advocate"}</span>
                <p>{message.text}</p>
              </div>
            ))}
          </div>

          <form className="demo-composer" onSubmit={sendMessage}>
            <label htmlFor="demo-message">Try a thought</label>
            <div className="demo-composer-row">
              <input
                id="demo-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="What are you trying to protect?"
              />
              <button type="submit">Send</button>
            </div>
          </form>
        </article>

        <aside className="demo-panel mediator-panel">
          <div className="demo-panel-heading">
            <div>
              <span className="demo-label">Shared surface</span>
              <h2>What can move?</h2>
            </div>
            <span className="demo-badge active">mediator</span>
          </div>

          <p className="demo-boundary">
            The mediator sees the shared summary below—not the private conversation on the left.
          </p>

          <div className="demo-topic-card">
            <span className="demo-label">Current topic</span>
            <strong>Launch support coverage</strong>
            <span className="demo-topic-state">in discussion</span>
          </div>

          <div className="demo-share-card">
            <div>
              <span className="demo-label">Controlled sharing</span>
              <strong>{shared ? "Support handoff is visible" : "Keep the constraint private"}</strong>
            </div>
            <button
              className={`demo-share-toggle ${shared ? "shared" : ""}`}
              type="button"
              onClick={() => setShared((current) => !current)}
            >
              {shared ? "Shared" : "Share a term"}
            </button>
          </div>

          {!recommendationVisible ? (
            <button
              className="demo-recommend-button"
              type="button"
              onClick={() => setRecommendationVisible(true)}
            >
              Show the next useful move <span>↗</span>
            </button>
          ) : (
            <div className="demo-recommendation">
              <span className="demo-label">Mediator suggestion</span>
              <p>
                Define a two-week support rotation, name the first owner, and review the workload
                before changing the launch date.
              </p>
            </div>
          )}
        </aside>
      </section>

      <section className="demo-outcome" aria-labelledby="outcome-title">
        <div>
          <span className="demo-label">Living outcome</span>
          <h2 id="outcome-title">A record everyone can inspect</h2>
        </div>
        <div className="demo-outcome-list">
          <div><span>Decision</span><strong>Keep the launch date under review</strong></div>
          <div><span>Open point</span><strong>{shared ? "Support rotation needs an owner" : "Support capacity is still private"}</strong></div>
          <div><span>Next step</span><strong>{recommendationVisible ? "Draft the first rotation" : "Surface a workable option"}</strong></div>
        </div>
      </section>

      <footer className="demo-footer">
        <span>Public demo · synthetic content · no network calls</span>
        <span>Production systems and prompt material remain private.</span>
      </footer>
    </main>
  );
}
