# Architecture

Current status: implementation foundation exists.

The repo now has the initial npm workspace scaffold, an `ia` CLI shell, explicit local setup configuration creation/validation, a real `ia doctor` diagnostics/preflight framework, a localhost-only SvelteKit editor shell, the first SQLite state-store foundation, and a shared article document model package with deterministic block parsing. Most architecture below remains target architecture from `interactive-article-platform-implementation.md` and must continue to be updated as implementation lands.

## Architecture Goal

Banderdash should be a local-first interactive article platform where a writer can paste prose, review meaningful interaction suggestions, preview approved interactions, and export a static web-component artifact.

## High-Level System

```text
Local CLI
  -> starts/checks local app

SvelteKit Editor
  -> article input
  -> touch-point review
  -> data-gap dialogs
  -> preview
  -> debug/history
  -> export controls

Workflow Backend
  -> structurer
  -> analyst
  -> critic
  -> consent/data gap
  -> spec agent
  -> builder
  -> static validator
  -> sandbox QA
  -> export

SQLite State Store
  -> articles
  -> document versions
  -> candidates
  -> approvals/rejections
  -> generated specs
  -> validation/QA results
  -> export records

Component Library
  -> audited Svelte interaction primitives

Export System
  -> immutable web-component JS bundle
  -> manifest
  -> preview HTML
```

## Main Parts

### CLI

Responsible for setup, diagnostics, provider preflight, and starting the local app.

Current implementation:

- `cli/src/ia.ts` dispatches `setup`, `doctor`, and `start`.
- `cli/src/config.ts` defines the MVP local config schema, default config, config path resolution, read/write helpers, and validation.
- `ia setup` creates `.banderdash/config.json` if missing and preserves existing config if present.
- The default config binds the app to `127.0.0.1`, uses port `5173`, leaves the provider unconfigured, and sets local SQLite/export paths under `.banderdash/`.
- `ia doctor` runs typed local diagnostics/preflight checks and returns a failing exit code when required checks fail.
- Current doctor checks cover Node.js version, local config validity, localhost-only binding, storage path readiness, and provider configuration placeholder status.
- `ia start` launches the SvelteKit editor dev server through npm, forcing `--host 127.0.0.1 --port 5173` and setting `HOST=127.0.0.1` / `PORT=5173`.
- `cli/src/ia.test.ts` covers help, command dispatch, setup config creation/idempotency, config validation, doctor before/after setup behavior, localhost-only start command preparation, `start --help`, and unknown command failure.

Expected commands from the MVP spec:

```bash
npx ia setup
npx ia doctor
npx ia start
```

### Editor

A local SvelteKit app for the writer-facing workflow.

Current implementation:

- `apps/editor` is a TypeScript SvelteKit workspace package.
- `apps/editor/vite.config.ts` binds dev and preview servers to `127.0.0.1` with strict ports.
- The current page is a non-persistent shell with placeholder panels for article input, touch-point review, preview, debug/history, and export.
- No editor API routes, SQLite persistence, workflow execution, component preview, or export controls are implemented yet.

Target responsibilities:

- paste/write article;
- view word count and document state;
- review suggested interaction touch-points;
- approve, reject, or tweak suggestions;
- fill missing data through built-in templates;
- preview generated interactions;
- export completed article artifact.

### Workflow Backend

A TypeScript workflow layer with explicit stages rather than a free-roaming agent.

Target flow:

```text
raw text
  -> Structurer
  -> Analyst
  -> Critic
  -> Consent/Data Gap
  -> Spec Agent
  -> Builder
  -> Static Validator
  -> Sandbox QA
  -> Export
```

### Document Model

`@banderdash/doc-model` defines the shared document shape used by parser, persistence, workflow, editor, and export code.

Current implementation:

- exports `ArticleDoc`, `Block`, `Span`, and `Signal` TypeScript types;
- exports the MVP `BlockType` vocabulary: `paragraph`, `heading`, `list`, `quote`;
- exports the MVP `SignalKind` vocabulary: `quantity`, `comparison`, `sequence`, `dataset`, `causal`, `geographic`, `jargon`, `thematic`;
- provides lightweight runtime validators for the current document model;
- counts pasted article words and enforces the 5,000-word MVP limit;
- parses pasted prose into deterministic heading, paragraph, list, and quote blocks with stable IDs.

Article persistence, version services, and block-level invalidation are not implemented yet.

### SQLite State

SQLite is intended to be the authoritative state store.

Current implementation:

- `backend` is a TypeScript workspace package for backend services.
- `backend/src/services/db.ts` opens local SQLite databases and ensures parent storage directories exist.
- `backend/src/services/migrations.ts` runs tracked SQL migrations idempotently.
- `migrations/001_init.sql` creates the initial MVP state tables for articles, document versions/blocks, workflow runs/events, candidates, approvals, generated specs, validation/QA results, exports, and LLM logs.
- The current SQLite implementation uses Node's built-in `node:sqlite` API because `better-sqlite3` hit native install/platform issues in the repo path.

It stores document versions, workflow state, approvals, generated specs, validation results, QA results, and export records.

### Component Library

The default generation path should use audited/config-driven Svelte components.

Initial intended library patterns:

- `ReactiveValue`
- `CompareToggle`

### Restricted Bespoke Generation

Bespoke generated components are allowed later in the MVP only under strict validation.

They must not use runtime network calls, storage APIs, dynamic code execution, raw HTML rendering, host DOM access, arbitrary imports, or external resources.

### Sandbox QA

Preview and QA should run locally in a restricted iframe.

Static validation is the hard gate. QA warnings may allow export only after explicit user confirmation.

### Export System

The MVP export target is an immutable static web-component artifact:

- uniquely named custom-element JS bundle;
- required machine-readable manifest;
- minimal preview HTML.

## Intended Repository Shape

```text
packages/
  components/
  doc-model/
  bundler/
  validators/
  providers/

apps/
  editor/

backend/
  graph/
  nodes/
  services/
  prompts/

cli/
sandbox/
migrations/
```

## Architecture Update Rule

Update this file when implementation changes:

- package/module boundaries;
- workflow stages;
- state model;
- provider architecture;
- component generation strategy;
- validation/QA architecture;
- export architecture;
- frontend-backend communication.

Do not update it for small styling changes, copy edits, trivial tests, or bug fixes that do not change system structure.
