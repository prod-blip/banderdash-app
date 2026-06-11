# Architecture

Current status: implementation foundation exists.

The repo now has the initial npm workspace scaffold, an `ia` CLI shell, explicit local setup configuration creation/validation, a real `ia doctor` diagnostics/preflight framework with provider preflight plumbing, a localhost-only SvelteKit editor shell with saved article input and article API routes, the first SQLite state-store foundation with invalidation columns, a shared article document model package with deterministic block parsing/invalidation diffing, a provider abstraction package with an OpenAI-compatible adapter, backend article persistence/version services with stale-version rejection and block-level generated-state invalidation, provider-backed Analyst/Critic/Spec Agent nodes, a library-first Builder node for audited `ReactiveValue` specs, initial restricted-subset static validation with persisted validation results, an editor touch-point review path for local candidate analysis and writer consent, and the first audited `ReactiveValue` component path. Most architecture below remains target architecture from `interactive-article-platform-implementation.md` and must continue to be updated as implementation lands.

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
- Current doctor checks cover Node.js version, local config validity, localhost-only binding, storage path readiness, SQLite state-store initialization/current migrations, and provider preflight status.
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
- The editor home page now has a saved article draft panel that posts pasted prose to `POST /api/articles`, updates via `PUT /api/articles/:id`, displays the saved article id/version, and renders the persisted block breakdown.
- The touch-point review panel can run local candidate analysis for a saved article, display Critic-surviving `ReactiveValue` candidates with rationale/source block/understanding-loss text, and record writer approval or rejection.
- Preview, debug/history, and export panels are still placeholders.
- `POST /api/articles` creates and persists an ArticleDoc from raw text.
- `GET /api/articles/:id` loads the latest persisted ArticleDoc.
- `PUT /api/articles/:id` updates an article using expected-version conflict checks.
- `POST /api/articles/:id/candidate-review` runs the current local Analyst -> Critic path for a saved article version and returns surviving candidates.
- `POST /api/articles/:id/approvals` records writer approval/rejection for Critic-surviving candidates with expected-version stale-action protection.
- The API resolves the local SQLite path from `.banderdash/config.json` and uses the backend article service.
- Autosave UI, persisted workflow run status, component preview, and export controls are not implemented yet.

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

Current implementation:

- `backend/src/nodes/schemas/candidate.ts` defines the typed candidate output boundary for provider-backed candidate generation.
- `backend/src/nodes/analyst.ts` runs the Analyst node through `LLMProvider.structured(...)` only; it checks structured-output capability, builds article/block-ID grounded prompts, validates returned candidate shape and article/version/block/span references, and persists proposed candidates to SQLite.
- `backend/src/nodes/critic.ts` runs the Critic node through `LLMProvider.structured(...)` only; it applies the enact-meaning-not-decoration rule to proposed candidates, requires exactly one decision for each input candidate, prevents ID/reference/pattern drift, and persists `survived` or `rejected_by_critic` status updates to SQLite.
- `backend/src/services/candidateConsent.ts` records writer approvals/rejections only for current-version, non-invalidated, Critic-surviving candidates.
- `backend/src/nodes/schemas/componentSpec.ts` defines the library component spec boundary consumed by the Builder.
- `backend/src/nodes/specAgent.ts` runs the Spec Agent through `LLMProvider.structured(...)` only; it selects writer-approved, Critic-surviving `ReactiveValue` candidates, validates provider specs against the audited component registry/prop schema, and persists valid specs to `generated_specs`.
- `backend/src/services/libraryLookup.ts` resolves library specs through the audited component registry and rejects unsupported modes, unsupported component names, and invalid component props.
- `backend/src/nodes/builder.ts` implements the current library-first Builder slice by converting valid `ReactiveValue` specs into audited component build units containing component path, props, fallback text, embedded data, and accessibility/reduced-motion notes for downstream validation/export.
- `backend/src/nodes/staticValidator.ts` validates library build units against the restricted subset and persists pass/fail records to `validation_results`.
- Candidate generation and critic pruning are testable with the deterministic fake provider and store full candidate payloads in `candidates.payload_json` while using `candidates.block_id` for block-level invalidation.
- The current editor route uses a deterministic local fake provider for visible smoke testing when running candidate review. Full provider selection, workflow graph persistence, cancellation, data-gap handling, preview/export gating, QA, and export are not implemented yet.

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

### Provider Abstraction

`@banderdash/providers` defines the boundary workflow nodes must use for LLM access.

Current implementation:

- exports `LLMProvider`, message, call, result, streaming chunk, structured schema, provider health, and provider capability types;
- includes a deterministic fake provider for tests and local workflow development;
- includes `runProviderPreflight`, which checks auth, configured model availability, structured-output support, optional streaming support, and minimum context window;
- includes an OpenAI-compatible adapter that reads API credentials/base URL from environment variables, uses `/models` for auth/model discovery, and supports chat completions, JSON-schema structured output, and streaming response parsing;
- `ia doctor` warns when no provider is configured and runs real preflight for `openai-compatible` configs.

Claude/Codex CLI adapters are not implemented yet.

### Document Model

`@banderdash/doc-model` defines the shared document shape used by parser, persistence, workflow, editor, and export code.

Current implementation:

- exports `ArticleDoc`, `Block`, `Span`, and `Signal` TypeScript types;
- exports the MVP `BlockType` vocabulary: `paragraph`, `heading`, `list`, `quote`;
- exports the MVP `SignalKind` vocabulary: `quantity`, `comparison`, `sequence`, `dataset`, `causal`, `geographic`, `jargon`, `thematic`;
- provides lightweight runtime validators for the current document model;
- counts pasted article words and enforces the 5,000-word MVP limit;
- parses pasted prose into deterministic heading, paragraph, list, and quote blocks with stable IDs;
- compares previous and next materialized blocks for MVP block-level invalidation by block id, type, and text.

Backend article persistence/version services and block-level invalidation are implemented.

Current backend service implementation:

- `backend/src/services/articles.ts` creates ArticleDocs from raw text using the shared parser and word-count limit;
- persists article rows, version snapshots, and materialized blocks to SQLite;
- updates articles by creating new document versions;
- checks expected versions on update and rejects stale writes;
- on valid article updates, marks generated state tied to changed blocks as invalidated across candidates, approvals, generated specs, validation results, QA results, and candidate-linked exports;
- loads the latest persisted materialized ArticleDoc.


### SQLite State

SQLite is intended to be the authoritative state store.

Current implementation:

- `backend` is a TypeScript workspace package for backend services.
- `backend/src/services/db.ts` opens local SQLite databases and ensures parent storage directories exist.
- `backend/src/services/migrations.ts` runs tracked SQL migrations idempotently.
- `migrations/001_init.sql` creates the initial MVP state tables for articles, document versions/blocks, workflow runs/events, candidates, approvals, generated specs, validation/QA results, exports, and LLM logs.
- `migrations/002_invalidation_columns.sql` adds invalidation timestamp/reason columns to generated-state tables that can become stale after article edits.
- `backend/src/services/articles.ts` provides create/update/get services for versioned ArticleDocs. It uses `@banderdash/doc-model` to parse and validate the 5,000-word limit, persists version snapshots in `article_versions`, materializes blocks in `article_blocks`, and rejects updates when the caller's expected document version is stale.
- The current SQLite implementation uses Node's built-in `node:sqlite` API because `better-sqlite3` hit native install/platform issues in the repo path.

It stores document versions, workflow state, approvals, generated specs, validation results, QA results, and export records.

### Component Library

The default generation path should use audited/config-driven Svelte components.

Current implementation:

- `@banderdash/components` is a TypeScript workspace package for audited interaction primitives.
- It exports a component registry with lookup by pattern/name and prop validators/fallback generators.
- `ReactiveValue` is the first registered audited component path. Its schema accepts bounded numeric parameters, a constrained add/multiply calculation, result/fallback labels, and rejects arbitrary formula strings.
- `packages/components/src/ReactiveValue.svelte` renders fallback text, a keyboard-reachable range input, and an `aria-live` result without network calls, storage APIs, dynamic code, or raw HTML.

Initial intended library patterns:

- `ReactiveValue`
- `CompareToggle`

### Static Validator

Current implementation:

- `@banderdash/validators` is a TypeScript workspace package for validation infrastructure.
- It exports shared validation finding/result types and `createValidationResult(...)` for constructing pass/fail results from hard failures and warnings.
- `packages/validators/src/restrictedSubset.ts` implements the current conservative restricted-subset check for component source.
- The restricted-subset check hard-blocks runtime network APIs, storage APIs, cookie access, dynamic code execution, dynamic imports, raw HTML rendering, host DOM access, remote URLs, unscoped global event listeners, and global timers.
- `backend/src/nodes/staticValidator.ts` applies the restricted-subset check to library build units and persists validation results.
- Preview/export gating is not implemented yet.

Target responsibility:

Hard-block unsafe generated/bespoke code and validate library build units before preview/export.

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
