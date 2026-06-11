# Engineering Context

This file is the Engineering Manager's short current-memory file for Banderdash.

It should stay concise and be updated when the real engineering state changes.

## Current State

Banderdash implementation has started.

The project currently has:

- an implementation specification: `interactive-article-platform-implementation.md`;
- project operating docs in `.banderdash-os/`;
- an npm workspace scaffold with intended MVP package/app boundaries;
- an `ia` CLI shell with `setup`, `doctor`, and `start` commands;
- explicit local setup config creation and validation for `.banderdash/config.json`;
- a real `ia doctor` check framework for local diagnostics/preflight, including SQLite state-store initialization/migration checks;
- a localhost-only SvelteKit editor shell with saved article input, placeholder workflow panels, and article API routes;
- a backend SQLite service package with idempotent initial migrations;
- shared ArticleDoc, Block, Span, and Signal types with lightweight runtime validators;
- deterministic pasted-prose block parsing with 5,000-word MVP limit enforcement;
- backend article persistence services for creating, updating, versioning, invalidating changed-block generated state, and loading latest ArticleDocs;
- a provider abstraction package with deterministic fake provider, OpenAI-compatible adapter, and preflight checks;
- a provider-backed Analyst node and a provider-backed Critic node that validate, persist, and prune proposed interaction candidates;
- an editor touch-point review path that can run local candidate analysis, show Critic-surviving candidates, and record writer approval/rejection;
- a component spec schema and provider-backed Spec Agent that convert approved `ReactiveValue` candidates into persisted audited component specs;
- a library-first Builder that converts valid `ReactiveValue` specs into audited component build units;
- an audited `ReactiveValue` component path with registry lookup, prop validation, fallback generation, and safe Svelte source;
- a static validator package shell with shared validation result/finding types;

The full persisted workflow graph, Claude/Codex provider adapters, CompareToggle component path, restricted-subset validator rules, sandbox QA, and export pipeline are not implemented yet.

## Current Phase

Implementation foundation: repository scaffold, CLI shell, setup configuration, diagnostics, and editor shell.

## Current Engineering Priority

1. Implement restricted-subset static checks and backend Static Validator node for library build units.
2. Add persisted workflow graph/run status around the Analyst -> Critic -> consent -> Spec Agent -> Builder path.
3. Add additional provider adapters only if needed for local workflow verification.

## MVP Plan Progress

`implementation-plan.md` currently lists 42 implementation tasks. Tasks 0.1, 0.2, 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 9.1, 9.2, 9.3, and 10.1 are landed on `main`, leaving 18 plan tasks. Do not treat that as 18 required PRs; the expected remaining reviewable PR count is roughly 18–23 if closely related small tasks are grouped carefully.

## Important Current Docs

- `.banderdash-os/README.md`
- `.banderdash-os/product-goal.md`
- `.banderdash-os/engineering-context.md`
- `interactive-article-platform-implementation.md`

## Known Risks

- The MVP is large and can easily become too broad.
- Component breadth can distract from proving the end-to-end workflow.
- AI-generated interactions can become decorative instead of meaningful.
- Architecture can become complex before the product loop is proven.
- Security constraints around generated/exported code must stay strict.

## Current Pushback Bias

Prefer smaller, testable steps.

Push back on:

- vague features;
- scope expansion before the first end-to-end workflow works;
- speculative architecture;
- features that do not improve the path from raw article to meaningful interaction to exportable artifact.

## Latest Important Changes

- Initialized the npm workspace scaffold and committed the Banderdash project docs/specs as the repository baseline.
- Merged GitHub PR #1 (`pr-2-cli-shell`): added the initial `ia` CLI shell with stub `setup`, `doctor`, and `start` commands.
- Merged GitHub PR #2 (`pr-3-setup-config`) into `main`: `ia setup` now creates and validates `.banderdash/config.json` with local-only defaults.
- Merged GitHub PR #4 (`pr-3-doctor-framework-main`) into `main`: re-landed PR #3's doctor framework from the stacked branch; `ia doctor` now runs real local diagnostics/preflight checks.
- Added the localhost-only editor shell: `ia start` launches the SvelteKit editor bound to `127.0.0.1:5173` with placeholder workflow panels.
- Added the SQLite state-store foundation: `backend` now opens local SQLite databases and runs idempotent initial migrations for MVP state tables.
- Added the shared article document model: `@banderdash/doc-model` now exports ArticleDoc, Block, Span, and Signal types plus lightweight validators for the MVP vocabularies.
- Added deterministic article text parsing: `@banderdash/doc-model` now splits pasted prose into heading, paragraph, list, and quote blocks with stable IDs and enforces the 5,000-word MVP limit.
- Added backend article persistence: `backend` can create versioned ArticleDocs, update them with expected-version checks, reject over-limit text, and load the latest materialized document.
- Extended `ia doctor` with a SQLite state check that opens the configured local database and runs current migrations.
- Added editor article API routes for creating, loading, and updating versioned ArticleDocs through the local SvelteKit server.
- Wired the editor input panel to the article API routes so pasted prose can create and update saved local ArticleDoc drafts from the browser UI.
- Added block-level invalidation: document model diffing identifies changed blocks, article updates reject stale versions before side effects, and generated state tied to changed blocks is marked invalidated in SQLite.
- Added provider abstraction and preflight: `@banderdash/providers` defines LLM provider contracts, fake provider, structured/capability checks, and `ia doctor` provider preflight plumbing.
- Added the first real provider adapter: `openai-compatible` supports environment-configured API keys/base URL, `/models` preflight, chat completions, structured JSON-schema calls, and streaming response parsing.
- Added workflow candidate generation: the Analyst node uses structured provider output only, validates article/version/block/span references, and persists proposed interaction candidates for later critic/consent stages.
- Added audited `ReactiveValue` component path: `@banderdash/components` now has registry lookup, schema validation, fallback generation, and a safe Svelte source component for bounded numeric interactions.
- Added the Critic node: backend workflow can now use structured provider output to mark proposed candidates as `survived` or `rejected_by_critic` using the enact-meaning-not-decoration rule.
- Added editor candidate review: saved drafts can run local Analyst/Critic review, display `ReactiveValue` candidates in Touch-point review, and record writer consent with expected-version safety.
- Added the Spec Agent path: backend now validates component specs, uses structured provider output to generate `ReactiveValue` specs for approved candidates, validates audited props, and persists specs in SQLite.
- Added the library-first Builder path: backend now resolves valid `ReactiveValue` specs through the audited component registry and converts them into component build units for validator/export follow-up.
- Added the static validator package shell: `@banderdash/validators` now defines shared validation finding/result types and a helper for pass/fail result construction.

## Update Rule

Update this file when:

- implementation phase changes;
- a meaningful PR is merged or closed;
- current architecture/code state changes;
- major risks change;
- next engineering priority changes.

Do not update this file for tiny copy edits, trivial refactors, or one-off notes that will not matter later.
