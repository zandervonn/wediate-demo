# Wediate is now live

**[Open the full Wediate site at wediate.app](https://wediate.app/).**

## Original demo

This repository contains the original offline preview of Wediate’s lobby, private advocate chat, decision flow, and private-terms redaction. You can run it locally with the steps below.

## What to try

- Read the opening chat: it explains that the session, participants, topics, and messages are synthetic.
- Switch between the Lobby and Session views from the top navigation.
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
