# Architecture

Current status: implementation foundation exists.

The repo now has the initial npm workspace scaffold, an `ia` CLI shell, and explicit local setup configuration creation/validation. Most architecture below remains target architecture from `interactive-article-platform-implementation.md` and must continue to be updated as implementation lands.

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
- `doctor` and `start` remain MVP stubs on `main`.
- `cli/src/ia.test.ts` covers help, command dispatch, setup config creation/idempotency, config validation, `start --help`, and unknown command failure.

Expected commands from the MVP spec:

```bash
npx ia setup
npx ia doctor
npx ia start
```

### Editor

A local SvelteKit app for the writer-facing workflow:

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

### SQLite State

SQLite is intended to be the authoritative state store.

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
