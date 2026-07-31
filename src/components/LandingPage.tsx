import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./LandingPage.css";

type LandingPageProps = {
  onEnterLobby: () => void;
};

type RevealProps = {
  children: ReactNode;
  className?: string;
};

const howItWorks = [
  {
    number: "01",
    title: "Open a shared room",
    body: "Name the decision, invite the people involved, and choose how much the mediator may share.",
    note: "Setup takes a few minutes",
  },
  {
    number: "02",
    title: "Talk to your own advocate",
    body: "Everyone gets a separate AI advocate that listens, challenges weak assumptions, and helps clarify what really matters.",
    note: "Private conversations",
  },
  {
    number: "03",
    title: "Let the mediator find movement",
    body: "A neutral mediator works across positions, tests workable trades, and brings each person the next useful question or proposal.",
    note: "No performative debate",
  },
  {
    number: "04",
    title: "Leave with something concrete",
    body: "As common ground forms, Wediate builds a living summary of decisions, open points, and the path forward.",
    note: "A guiding document, not a legal contract",
  },
];

const useCases = [
  {
    label: "Collaborators",
    title: "Agree before the work gets complicated.",
    body: "Set expectations around direction, ownership, roles, money, and what happens when plans change.",
    example: "Creator partnerships · podcasts · shared projects",
  },
  {
    label: "Teams",
    title: "Make room for the position nobody says in the meeting.",
    body: "Gather honest private input, surface the real trade-offs, and move a stuck decision toward a practical choice.",
    example: "Roadmaps · working agreements · policy decisions",
  },
  {
    label: "People at an impasse",
    title: "Lower the temperature without lowering the stakes.",
    body: "Work through a bounded disagreement when direct conversation is going in circles and the relationship still matters.",
    example: "Scope · responsibilities · money · next steps",
  },
];

const faqs = [
  {
    question: "Can the other people read my chat?",
    answer:
      "No. Your conversation is with your own advocate. Exact details marked as private are held back unless you approve sharing them. Wediate also reviews for paraphrase and inference risk, but that broader protection is best-effort rather than a zero-leak guarantee.",
  },
  {
    question: "Does the AI decide who is right?",
    answer:
      "No. The mediator evaluates options and can recommend a fair, workable path, but people keep control. Nothing is shared or agreed on your behalf.",
  },
  {
    question: "What kinds of decisions fit?",
    answer:
      "Wediate works best for a few meaningful, forward-looking topics between people who want to keep working or living well together. It is not for emergencies, abuse situations, litigation, or stakes you would take to a lawyer.",
  },
  {
    question: "Is the final document legally binding?",
    answer:
      "No. The output is a clear guiding record of what the group aligned on and what remains open. Get professional advice when legal enforceability matters.",
  },
  {
    question: "What is this public demo?",
    answer:
      "This repository is a browser-only walkthrough with synthetic content. It is designed to show the product surface without exposing the production service, private prompts, or real session data.",
  },
];

function Reveal({ children, className = "" }: RevealProps) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          element.dataset.visible = "true";
          observer.disconnect();
        }
      },
      { threshold: 0.14 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={elementRef} className={`landing-reveal ${className}`}>
      {children}
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3.5 9h10M9.5 5l4 4-4 4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5 10.2 3.1 3.1L15 6.8" />
    </svg>
  );
}

function LandingLogo() {
  return (
    <a className="landing-logo" href="#top" aria-label="Wediate home">
      <span className="landing-logo-mark">W</span>
      <span>Wediate</span>
    </a>
  );
}

function MediationMap() {
  return (
    <div className="mediation-map" aria-label="A visual map of two private advocates working through a neutral mediator">
      <div className="map-grid" aria-hidden="true" />
      <div className="map-orbit map-orbit-one" aria-hidden="true" />
      <div className="map-orbit map-orbit-two" aria-hidden="true" />

      <svg className="map-paths" viewBox="0 0 720 560" aria-hidden="true">
        <defs>
          <linearGradient id="leftPath" x1="120" y1="100" x2="360" y2="280" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8f6b4b" stopOpacity=".18" />
            <stop offset="1" stopColor="#2f5c75" stopOpacity=".75" />
          </linearGradient>
          <linearGradient id="rightPath" x1="600" y1="100" x2="360" y2="280" gradientUnits="userSpaceOnUse">
            <stop stopColor="#cf936f" stopOpacity=".2" />
            <stop offset="1" stopColor="#2f5c75" stopOpacity=".75" />
          </linearGradient>
        </defs>
        <path className="map-line left" d="M118 130 C 192 142, 218 248, 317 270" stroke="url(#leftPath)" />
        <path className="map-line right" d="M602 130 C 528 142, 502 248, 403 270" stroke="url(#rightPath)" />
        <path className="map-line outcome" d="M360 316 C 360 350, 360 382, 360 426" />
      </svg>

      <span className="moving-signal signal-left" aria-hidden="true" />
      <span className="moving-signal signal-right" aria-hidden="true" />
      <span className="moving-signal signal-outcome" aria-hidden="true" />

      <div className="map-node map-person map-person-left">
        <span className="map-avatar">A</span>
        <span className="map-node-copy">
          <small>Private room</small>
          <strong>Your advocate</strong>
        </span>
        <span className="privacy-lock" aria-label="Private">
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M5.5 8V6.4a3.5 3.5 0 0 1 7 0V8M4.5 8h9v7h-9z" />
          </svg>
        </span>
      </div>

      <div className="map-node map-person map-person-right">
        <span className="map-avatar coral">B</span>
        <span className="map-node-copy">
          <small>Private room</small>
          <strong>Their advocate</strong>
        </span>
        <span className="privacy-lock" aria-label="Private">
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M5.5 8V6.4a3.5 3.5 0 0 1 7 0V8M4.5 8h9v7h-9z" />
          </svg>
        </span>
      </div>

      <div className="map-mediator">
        <span className="mediator-pulse" aria-hidden="true" />
        <span className="mediator-mark">
          <svg viewBox="0 0 28 28" aria-hidden="true">
            <path d="M6 9.5 14 5l8 4.5v9L14 23l-8-4.5z" />
            <path d="m9.5 11.5 4.5 2.7 4.5-2.7M14 14.2V19" />
          </svg>
        </span>
        <small>Neutral intelligence</small>
        <strong>Active mediator</strong>
      </div>

      <div className="map-outcome">
        <span className="outcome-fold" aria-hidden="true" />
        <span className="outcome-icon">
          <svg viewBox="0 0 22 22" aria-hidden="true">
            <path d="M6 3.5h7l3 3V18.5H6z" />
            <path d="M13 3.5v3h3M8.5 11h5M8.5 14h5" />
          </svg>
        </span>
        <span>
          <small>Shared surface</small>
          <strong>Living agreement</strong>
        </span>
        <span className="outcome-state">building</span>
      </div>

      <div className="map-caption">
        <span className="caption-dot" />
        Content stays in its lane. Progress moves between them.
      </div>
    </div>
  );
}

function PrivacyFlow() {
  return (
    <div className="privacy-flow" aria-label="Private information flows only when a participant approves it">
      <div className="privacy-source">
        <span className="privacy-source-label">Only you + your advocate</span>
        <div className="private-thought">
          <span>My real priority</span>
          <small>held back</small>
        </div>
        <div className="private-thought">
          <span>My fallback</span>
          <small>held back</small>
        </div>
        <div className="private-thought">
          <span>The number I can accept</span>
          <small>held back</small>
        </div>
      </div>
      <div className="privacy-control">
        <span className="control-line" />
        <span className="control-lock">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 10V8a5 5 0 0 1 10 0v2M5.5 10h13v10h-13z" />
            <path d="M12 14v2.5" />
          </svg>
        </span>
        <span className="control-copy">You approve sharing</span>
        <span className="control-line" />
      </div>
      <div className="privacy-shared">
        <span className="privacy-source-label">Visible to the group</span>
        <div className="shared-progress">
          <span className="shared-progress-bar"><i style={{ width: "72%" }} /></span>
          <span>Progress on scope</span>
        </div>
        <div className="shared-progress">
          <span className="shared-progress-bar"><i style={{ width: "46%" }} /></span>
          <span>Working option</span>
        </div>
        <div className="shared-document">
          <CheckIcon />
          Shared terms
        </div>
      </div>
    </div>
  );
}

export function LandingPage({ onEnterLobby }: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState(0);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.dataset.theme;
    root.dataset.theme = "light";
    root.classList.add("landing-active");

    return () => {
      root.classList.remove("landing-active");
      if (previousTheme) root.dataset.theme = previousTheme;
      else delete root.dataset.theme;
    };
  }, []);

  return (
    <main className="landing-page" id="top">
      <header className="landing-header">
        <LandingLogo />
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
          <a href="#use-cases">Who it’s for</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <button type="button" className="landing-header-cta" onClick={onEnterLobby}>
          Enter the lobby
          <ArrowIcon />
        </button>
      </header>

      <section className="landing-hero">
        <div className="hero-atmosphere" aria-hidden="true">
          <span className="hero-glow glow-one" />
          <span className="hero-glow glow-two" />
          <span className="hero-grain" />
        </div>
        <div className="landing-container hero-layout">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="eyebrow-pulse" />
              Private AI advocates · One neutral mediator
            </div>
            <h1>
              Say the hard thing
              <span className="hero-title-turn">
                privately. Move <em>forward</em> together.
              </span>
            </h1>
            <p className="hero-description">
              Wediate gives each person a private place to think out loud, then helps the group turn
              different positions into clear, workable next steps.
            </p>
            <div className="hero-actions">
              <button type="button" className="landing-button primary" onClick={onEnterLobby}>
                Try the product demo
                <ArrowIcon />
              </button>
              <a className="landing-button quiet" href="#how-it-works">
                See how it works
              </a>
            </div>
            <div className="hero-trust-row" aria-label="Early access details">
              <span><CheckIcon /> Product demo</span>
              <span><CheckIcon /> Synthetic data</span>
              <span><CheckIcon /> You control sharing</span>
            </div>
          </div>
          <div className="hero-visual">
            <MediationMap />
          </div>
        </div>
        <div className="hero-bridge">
          <span>Built for decisions with</span>
          <div className="bridge-words" aria-label="money, trust, trade-offs, and a relationship attached">
            <strong>money</strong>
            <i />
            <strong>trust</strong>
            <i />
            <strong>trade-offs</strong>
            <i />
            <strong>a relationship attached</strong>
          </div>
        </div>
      </section>

      <section className="landing-overview" aria-labelledby="overview-title">
        <div className="landing-container">
          <Reveal className="overview-heading">
            <span className="section-kicker">A better room for difficult decisions</span>
            <h2 id="overview-title">Not a group chat with an AI dropped into it.</h2>
            <p>
              Wediate changes the shape of the conversation: private reflection at the edges,
              structured movement in the middle, and a shared record everyone can inspect.
            </p>
          </Reveal>
          <Reveal className="overview-grid">
            <article className="overview-card">
              <span className="overview-index">PRIVATE</span>
              <div className="overview-icon shield">
                <svg viewBox="0 0 28 28" aria-hidden="true">
                  <path d="M14 3.5 23 7v6.5c0 5.2-3.7 9-9 11-5.3-2-9-5.8-9-11V7z" />
                  <path d="m10 14 2.6 2.6 5.7-6" />
                </svg>
              </div>
              <h3>Your own advocate</h3>
              <p>
                Think, vent, test an argument, and find the need underneath your first position
                without performing it for everyone else.
              </p>
            </article>
            <article className="overview-card featured">
              <span className="overview-index">ACTIVE</span>
              <div className="overview-icon compass">
                <svg viewBox="0 0 28 28" aria-hidden="true">
                  <circle cx="14" cy="14" r="10" />
                  <path d="m18.5 9.5-2.7 6.3-6.3 2.7 2.7-6.3z" />
                </svg>
              </div>
              <h3>A mediator that moves</h3>
              <p>
                It does more than summarize. It challenges, connects priorities, tests packages,
                and recommends the next workable move.
              </p>
            </article>
            <article className="overview-card">
              <span className="overview-index">CONCRETE</span>
              <div className="overview-icon document">
                <svg viewBox="0 0 28 28" aria-hidden="true">
                  <path d="M7 3.5h9l5 5v16H7z" />
                  <path d="M16 3.5v5h5M10 14h8M10 18h8" />
                </svg>
              </div>
              <h3>A living outcome</h3>
              <p>
                Shared terms appear as they become real. The final document separates decisions,
                partial ground, and what still needs work.
              </p>
            </article>
          </Reveal>
        </div>
      </section>

      <section className="how-section" id="how-it-works" aria-labelledby="how-title">
        <div className="landing-container">
          <Reveal className="section-heading split">
            <div>
              <span className="section-kicker">How it works</span>
              <h2 id="how-title">One conversation.<br />Four clear movements.</h2>
            </div>
            <p>
              No mediation vocabulary to learn. No debate stage. Each person talks naturally,
              while Wediate keeps the process moving and the shared state precise.
            </p>
          </Reveal>

          <div className="how-timeline">
            {howItWorks.map((item, index) => (
              <Reveal className="how-step" key={item.number}>
                <div className="how-number">
                  <span>{item.number}</span>
                  {index < howItWorks.length - 1 ? <i aria-hidden="true" /> : null}
                </div>
                <div className="how-content">
                  <span className="how-note">{item.note}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
                <div className={`how-sketch sketch-${index + 1}`} aria-hidden="true">
                  {index === 0 ? (
                    <>
                      <span className="sketch-field wide" />
                      <span className="sketch-field" />
                      <span className="sketch-invite">Invite code · ses_••••</span>
                    </>
                  ) : null}
                  {index === 1 ? (
                    <>
                      <span className="sketch-bubble user" />
                      <span className="sketch-bubble bot" />
                      <span className="sketch-private">Private</span>
                    </>
                  ) : null}
                  {index === 2 ? (
                    <>
                      <span className="sketch-option one" />
                      <span className="sketch-option two" />
                      <span className="sketch-option three" />
                      <span className="sketch-link" />
                    </>
                  ) : null}
                  {index === 3 ? (
                    <>
                      <span className="sketch-document-line short" />
                      <span className="sketch-document-line" />
                      <span className="sketch-document-line" />
                      <span className="sketch-check"><CheckIcon /></span>
                    </>
                  ) : null}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="privacy-section" id="privacy" aria-labelledby="privacy-title">
        <div className="landing-container">
          <Reveal className="privacy-heading">
            <span className="section-kicker light">Privacy, made visible</span>
            <h2 id="privacy-title">Your leverage should not become someone else’s ammunition.</h2>
            <p>
              Every person gets a separate conversation. Specifics marked private stay locked
              unless their owner chooses to release them.
            </p>
          </Reveal>
          <Reveal>
            <PrivacyFlow />
          </Reveal>
          <Reveal className="privacy-contract">
            <div className="contract-mark">W</div>
            <div>
              <h3>An honest privacy promise</h3>
              <p>
                Exact protected names, numbers, dates, and details are blocked by code. Wediate
                also checks for paraphrase and inference risk across multiple review layers. That
                broader protection is best-effort—not a legal-vault guarantee.
              </p>
            </div>
            <a href="#faq">Read the plain-language FAQ <ArrowIcon /></a>
          </Reveal>
        </div>
      </section>

      <section className="use-cases-section" id="use-cases" aria-labelledby="use-cases-title">
        <div className="landing-container">
          <Reveal className="section-heading centered">
            <span className="section-kicker">Where Wediate fits</span>
            <h2 id="use-cases-title">For people who need the relationship after the decision.</h2>
            <p>
              The sweet spot is a few meaningful topics, honest private positions, and a real
              reason to find a way forward.
            </p>
          </Reveal>
          <div className="use-case-grid">
            {useCases.map((useCase, index) => (
              <Reveal className="use-case-card" key={useCase.label}>
                <span className="use-case-number">0{index + 1}</span>
                <span className="use-case-label">{useCase.label}</span>
                <h3>{useCase.title}</h3>
                <p>{useCase.body}</p>
                <span className="use-case-example">{useCase.example}</span>
              </Reveal>
            ))}
          </div>
          <Reveal className="boundary-note">
            <span className="boundary-icon">!</span>
            <p>
              <strong>Know the boundary.</strong> Wediate is collaborative decision support, not
              legal advice or an emergency service. Do not use it for abuse situations, litigation,
              or stakes you would take to a lawyer.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="architecture-section" aria-labelledby="architecture-title">
        <div className="landing-container architecture-layout">
          <Reveal className="architecture-copy">
            <span className="section-kicker">Why it is different</span>
            <h2 id="architecture-title">A coordination layer built around private context.</h2>
            <p>
              Most collaboration tools make everyone share first and sort it out later. Wediate
              starts from the opposite premise: better decisions need honest private input and
              deliberate, controlled movement into common ground.
            </p>
            <button type="button" className="text-button" onClick={onEnterLobby}>
              Experience the product <ArrowIcon />
            </button>
          </Reveal>
          <Reveal className="architecture-stack">
            <div className="stack-layer private-layer">
              <span className="stack-label">01 · PRIVATE CONTEXTS</span>
              <strong>One advocate per person</strong>
              <span>Separate histories · separate interests · private reflection</span>
            </div>
            <div className="stack-connector" aria-hidden="true">
              <span />
              <small>controlled disclosure</small>
              <span />
            </div>
            <div className="stack-layer mediator-layer">
              <span className="stack-label">02 · MEDIATION</span>
              <strong>Shared intelligence, code-enforced rails</strong>
              <span>Convergence · proposals · privacy gates · visible progress</span>
            </div>
            <div className="stack-connector" aria-hidden="true">
              <span />
              <small>agreed movement</small>
              <span />
            </div>
            <div className="stack-layer outcome-layer">
              <span className="stack-label">03 · SHARED STATE</span>
              <strong>A record everyone can inspect</strong>
              <span>Working terms · decisions · open questions · next steps</span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="pricing-section" id="pricing" aria-labelledby="pricing-title">
        <div className="landing-container">
          <Reveal className="section-heading centered pricing-heading">
            <span className="section-kicker">Public demo scope</span>
            <h2 id="pricing-title">See the shape before the system gets bigger.</h2>
            <p>
              This public surface is intentionally small: it demonstrates the interaction model
              with synthetic content while the production service remains private.
            </p>
          </Reveal>
          <div className="pricing-grid">
            <Reveal className="pricing-card current">
              <span className="pricing-status">Available here</span>
              <h3>Interactive walkthrough</h3>
              <div className="price">
                <span>Local</span>
                <small>synthetic data</small>
              </div>
              <p>Explore the product surface without an account, API key, or network request.</p>
              <ul>
                <li><CheckIcon /> Private advocate interaction</li>
                <li><CheckIcon /> Controlled sharing</li>
                <li><CheckIcon /> Mediator next-move suggestion</li>
                <li><CheckIcon /> Shared outcome surface</li>
              </ul>
              <button type="button" className="landing-button primary full" onClick={onEnterLobby}>
                Open demo
                <ArrowIcon />
              </button>
              <span className="pricing-fine">No real session is created.</span>
            </Reveal>
            <Reveal className="pricing-card future">
              <span className="pricing-status muted">Kept private</span>
              <h3>Production system</h3>
              <div className="price">
                <span>Private</span>
                <small>not included</small>
              </div>
              <p>The full backend, prompt system, and operational safeguards stay outside this public repository.</p>
              <ul>
                <li><CheckIcon /> Real provider orchestration</li>
                <li><CheckIcon /> Persistent session state</li>
                <li><CheckIcon /> Consent and disclosure controls</li>
                <li><CheckIcon /> Production deployment work</li>
              </ul>
              <div className="future-note">Not part of the public demo.</div>
            </Reveal>
            <Reveal className="pricing-card pilot">
              <span className="pricing-status muted">Next layer</span>
              <h3>Evidence before scale</h3>
              <div className="price">
                <span>Later</span>
                <small>product work</small>
              </div>
              <p>Reliable live sessions, safety evidence, and user learning come before any public service claim.</p>
              <ul>
                <li><CheckIcon /> Synthetic scenario coverage</li>
                <li><CheckIcon /> Clear failure handling</li>
                <li><CheckIcon /> Cost and rate limits</li>
                <li><CheckIcon /> Human review of claims</li>
              </ul>
              <button type="button" className="landing-button outline full" onClick={onEnterLobby}>
                Explore the demo
                <ArrowIcon />
              </button>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="faq-section" id="faq" aria-labelledby="faq-title">
        <div className="landing-container faq-layout">
          <Reveal className="faq-intro">
            <span className="section-kicker">Questions worth asking</span>
            <h2 id="faq-title">Before you invite someone.</h2>
            <p>
              Trust should come from understanding the boundary, not from a polished promise.
            </p>
          </Reveal>
          <Reveal className="faq-list">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div className={`faq-item ${isOpen ? "open" : ""}`} key={faq.question}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                  >
                    <span>{faq.question}</span>
                    <i aria-hidden="true" />
                  </button>
                  <div className="faq-answer" aria-hidden={!isOpen}>
                    <p>{faq.answer}</p>
                  </div>
                </div>
              );
            })}
          </Reveal>
        </div>
      </section>

      <section className="final-cta-section">
        <div className="final-cta-atmosphere" aria-hidden="true" />
        <div className="landing-container final-cta-layout">
          <Reveal className="final-cta-copy">
            <span className="section-kicker light">The next move can be quieter</span>
            <h2>A difficult conversation does not have to become a louder one.</h2>
            <p>Create the room. Invite the people. Keep control of what is yours.</p>
            <button type="button" className="landing-button light" onClick={onEnterLobby}>
              Enter the lobby
              <ArrowIcon />
            </button>
          </Reveal>
          <div className="final-cta-mark" aria-hidden="true">
            <span>W</span>
            <i className="mark-ring ring-one" />
            <i className="mark-ring ring-two" />
            <i className="mark-dot dot-one" />
            <i className="mark-dot dot-two" />
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container footer-layout">
          <div>
            <LandingLogo />
            <p>Private advocacy. Shared progress.</p>
          </div>
          <div className="footer-links">
            <a href="#how-it-works">How it works</a>
            <a href="#privacy">Privacy</a>
            <a href="#pricing">Pricing</a>
            <button type="button" onClick={onEnterLobby}>Lobby</button>
          </div>
          <p className="footer-legal">
            Wediate is collaborative decision-support software, not legal advice or an emergency service.
          </p>
        </div>
      </footer>
    </main>
  );
}
