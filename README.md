# Wediate - sanitized product demo

Wediate is a product concept for difficult decisions: each person gets a private place to think, while a shared surface helps the group find workable next steps.

This repository is a **sanitized public snapshot of the real Wediate frontend UI**. It opens directly into a clearly labelled public preview so the interface, topic rail, private advocate chat, mediator state, and private-terms redaction flow can be inspected without a live service.

## What to try

- Read the opening chat: it explains that the session, participants, topics, and messages are synthetic.
- Inspect the real session layout: presence, phase rail, topic cards, private chat, and the private-terms redaction panel.
- Use the theme control and session-code controls to explore the shell.
- Expand the topic cards to see how open work and a partial agreement are represented.

## Run locally

```bash
npm ci
npm test
npm run build
npm run dev
```

The public demo makes no network requests and does not require an API key. The local adapter exists only to keep shared UI components renderable; it contains no production transport, provider client, prompt system, or server route.

## Why this repository is separate

The full Wediate project remains private. This public repository contains the user-facing frontend surface and a clean mock boundary, but not the production backend, private prompt material, internal architecture documents, live session data, deployment configuration, or private engineering history.

## Boundary

Wediate is collaborative decision-support software, not legal advice or an emergency service. The privacy language in this demo describes a product goal; it is not a guarantee that a production system can never leak information.
