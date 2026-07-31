# Wediate — sanitized product demo

Wediate is a product concept for difficult decisions: each person gets a private place to think, while a shared surface helps the group find workable next steps.

This repository is intentionally a **frontend-only, browser-local demo**. It shows the product experience and interaction model with synthetic content. It does not contain the production backend, private prompt material, internal architecture documents, live session data, or account credentials.

## What to try

- Open the product overview.
- Enter the synthetic workspace.
- Send a thought to the sample advocate.
- Toggle a constraint from private to shared.
- Ask the sample mediator for the next useful move.

## Run locally

```bash
npm ci
npm test
npm run build
npm run dev
```

The demo makes no network requests and does not require an API key.

## Why this repository is separate

The full Wediate project remains private. This public repository is a deliberately small portfolio surface: enough to inspect the product thinking, interaction design, and frontend implementation without publishing the production prompt system or private engineering history.

## Boundary

Wediate is collaborative decision-support software, not legal advice or an emergency service. The privacy language in this demo describes a product goal; it is not a guarantee that a production system can never leak information.
