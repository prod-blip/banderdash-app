# Banderdash App

Banderdash is a local-first interactive article platform. The tightened MVP helps a writer move from raw prose to reviewed, meaningful interactions and export a static web-component artifact.

Core principle: an interaction must enact meaning, not decorate it. It earns its place only if removing it would cost the reader understanding, not just visual interest.

## Current MVP status

The current local MVP path is implemented for two audited library patterns:

- `ReactiveValue` for bounded numeric relationships.
- `CompareToggle` for meaningful A/B tradeoff comparisons.

The app currently supports a local workflow:

```text
setup -> doctor -> start editor -> paste article -> save draft -> analyze candidates -> approve/reject -> export immutable artifact -> inspect debug/history
```

The MVP is intentionally single-user and self-hosted. The editor binds to `127.0.0.1` and stores local state/artifacts under `.banderdash/` by default.

## Prerequisites

- Node.js 22+.
- npm.
- macOS/Linux shell from the repository root.

## Install

```bash
npm install
```

## Local setup

Create the local Banderdash config:

```bash
node node_modules/.bin/ia setup
```

This creates `.banderdash/config.json` if it does not already exist. Defaults are local-only:

- host: `127.0.0.1`
- editor port: `5173`
- SQLite database: `.banderdash/banderdash.sqlite`
- export root: `.banderdash/exports`

Do not commit `.banderdash/`; it contains local runtime state.

## Doctor / preflight

Run diagnostics before starting the editor:

```bash
node node_modules/.bin/ia doctor
```

Doctor checks local config, localhost-only binding, storage readiness, SQLite migration readiness, Node version, and provider readiness.

Provider note: no real provider is required for the deterministic local/fake workflow used by the current editor smoke path. If an OpenAI-compatible provider is configured, doctor also runs provider preflight.

## Start the editor

```bash
node node_modules/.bin/ia start
```

Open the printed local URL. The editor should be served only from `127.0.0.1` / localhost.

## Basic usage

1. Paste article prose into the editor.
2. Save the draft.
3. Run candidate analysis.
4. Review Critic-surviving interaction candidates.
5. Approve only candidates that materially improve reader understanding.
6. Export approved current-version candidates.
7. Inspect the generated export directory, `manifest.json`, `preview.html`, custom-element JS, and debug/history records.

The editor enforces the current 5,000-word MVP article limit through the shared document model/backend services.

## Export output

Successful exports create immutable local artifact directories containing:

- custom-element JavaScript;
- `manifest.json` with article/export/component metadata;
- `preview.html` for local inspection;
- file byte sizes and SHA-256 metadata.

Re-exporting creates a new artifact path instead of overwriting a previous export. Older completed export artifact directories are cleaned according to the backend retention policy while SQLite export history remains available.

## Development commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=critical
```

Useful targeted checks:

```bash
node node_modules/.bin/ia setup
node node_modules/.bin/ia doctor
```

## Manual MVP QA

Use the repeatable checklist before calling a local build MVP-ready:

```text
docs/manual-qa.md
```

The checklist covers install, setup, doctor, localhost editor startup, article save/update, candidate review, approvals/rejections, immutable export inspection, debug/history, invalidation, cancellation, QA warning confirmation, and static-validation hard-block expectations.

## Current limitations

These are intentional limits for the tightened MVP, not regressions:

- Single-user local/self-hosted app only.
- No hosted SaaS, auth, collaboration, LAN editor, CDN, or additional export modes.
- Library-first generation only for the current audited `ReactiveValue` and `CompareToggle` paths.
- Restricted bespoke generation is deferred.
- Browser-backed visual QA is not implemented; current Sandbox QA is backend/non-visual.
- Additional provider adapters beyond the OpenAI-compatible adapter are deferred unless explicitly needed.
- The editor Preview panel may still be placeholder-like; inspect generated `preview.html` and export manifests for artifact verification.

## Project docs

Primary project operating docs live under `.banderdash-os/`.

Key files:

- `.banderdash-os/product-goal.md`
- `.banderdash-os/engineering-context.md`
- `.banderdash-os/architecture.md`
- `interactive-article-platform-implementation.md`
- `docs/manual-qa.md`
