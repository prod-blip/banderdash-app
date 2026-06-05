# Interactive Article Platform - Implementation Specification

## 1. Overview

This document specifies how to build a local-first platform that turns ordinary written articles into interactive ones. A user pastes raw prose; a pipeline of AI-assisted nodes identifies places where an interaction would deepen understanding; the user approves, rejects, tweaks, or supplies required data; the system generates the approved interactions; and the result is exported as a self-contained, immutable web-component artifact.

The product rests on one rule:

> **An interaction must enact meaning, not decorate it.** It earns its place only if removing it would cost the reader understanding, not just visual interest. Anything that fails this test is cut.

The system is intentionally scoped as a **single-user local/self-hosted install**. Users run it on their own machine or server, use their own model-provider credentials or CLI login, and build/export artifacts locally. There is no hosted SaaS, CDN, multi-user tenancy, remote collaboration, or LAN editor mode in the MVP.

### What the user does

1. Installs the package and runs explicit setup/preflight through the CLI.
2. Starts a localhost-only web editor.
3. Pastes article text up to the MVP hard limit of 5,000 words.
4. Reviews proposed interaction touch-points highlighted inline.
5. Approves, rejects, or tweaks each suggestion.
6. Supplies missing data through built-in audited templates only.
7. Previews the generated article locally.
8. Exports an immutable static artifact containing a JS bundle, manifest, and preview HTML.

### What the system is, in one sentence

A local SvelteKit editor backed by a TypeScript agent/workflow pipeline, SQLite state store, provider abstraction, local sandbox/QA/build process, restricted generated-component subset, and immutable static web-component export.

---

## 2. Deployment Model

The MVP is a **single-user local/self-hosted application**.

- The user installs and runs the platform on their own machine or server.
- The local web server binds to `localhost` only.
- The MVP has no remote/LAN mode and no authentication for the localhost-only UI.
- If LAN/remote access is added later, it must be a separate explicit design with authentication and threat-model updates.
- All orchestration, parsing, component generation, sandbox preview, QA, compilation, and export happen locally.
- The only external calls are to the selected model provider, either through a local provider CLI or direct API access.

The setup flow is CLI-first:

```bash
npm install <package>
npx ia setup
npx ia doctor
npx ia start
```

`npm install` or postinstall may print next-step instructions, but it must not run interactive setup. Interactive configuration belongs in the explicit setup command.

The MVP includes both CLI and web UI:

- CLI: setup, provider preflight, diagnostics, local server start.
- Web UI: article authoring, consent, preview, debug/history, export.

---

## 3. System Map

There are four core parts.

**The platform editor** is a SvelteKit application served locally. It presents the article editor, touch-point review, data-gap dialogs, preview, debug/history, and export UI.

**The workflow backend** is a TypeScript orchestration layer using explicit graph-style stages. It stores state in SQLite, calls model providers through a capability-checked provider abstraction, and routes work through deterministic validators before any generated artifact can be exported.

**The shared component library** is a package of audited Svelte interaction primitives. It is the default generation target. The Builder must use library/config-driven components whenever possible.

**The export system** compiles the approved article into immutable static files: a uniquely named custom-element JS bundle, a required manifest, and a minimal standalone preview HTML file.

The optional Astro/MDX blog target from the earlier plan is no longer part of the MVP path. It can be revisited later as a secondary export format.

---

## 4. Technology Choices

**TypeScript end to end.** The editor, orchestration, parser integration, component generation, validation, and export pipeline all run in the JavaScript/TypeScript ecosystem.

**SvelteKit for the editor.** The editor is a stateful local app with streaming progress, autosave, preview, and workflow controls.

**Svelte for components and export.** Svelte can compile custom elements suitable for a static web-component export.

**SQLite for state.** SQLite is the single authoritative store for MVP project/runtime/workflow state. No editable project-file system exists in MVP.

**Explicit workflow graph.** The pipeline is modeled as explicit stages rather than a single free-roaming agent. ReAct-style repair loops are allowed only inside bounded generation/QA steps.

**Pluggable provider abstraction.** Claude/Codex are supported through AO-style local CLI login where possible, with direct API-key/env configuration as fallback.

---

## 5. State and Document Model

SQLite is the single source of truth for:

- articles and document versions
- parsed blocks/spans/signals
- candidates
- approvals/rejections/tweaks
- missing-data template choices
- workflow checkpoints
- generated specs
- static validation results
- QA warnings/failures
- cancellation state
- export records
- structured LLM inputs/outputs, errors, timing, and token/cost metadata where available

The MVP does not use editable project files. Final article exports are separate immutable artifacts.

State must not be treated as one mutable blob. The implementation should store:

- latest materialized document state for fast loading
- append-only event/history rows for meaningful workflow transitions
- document version numbers for stale-action rejection and invalidation

### ArticleDoc

```typescript
interface ArticleDoc {
  id: string;
  version: number;
  blocks: Block[];
  meta: {
    title?: string;
    createdAt: string;
    updatedAt: string;
    wordCount: number;
  };
}

interface Block {
  id: string;
  version: number;
  type: "paragraph" | "heading" | "list" | "quote";
  text: string;
  spans: Span[];
  signals: Signal[];
}

interface Span {
  id: string;
  text: string;
  start: number;
  end: number;
}

interface Signal {
  spanId: string;
  kind:
    | "quantity"
    | "comparison"
    | "sequence"
    | "dataset"
    | "causal"
    | "geographic"
    | "jargon"
    | "thematic";
  confidence: number;
}
```

### Edits and invalidation

Users may edit the article after candidates have been generated. Edits create a new document version.

For MVP, invalidation is **block-level**:

- if a paragraph, heading, list item, or quote block changes, all candidates, approvals, specs, generated components, QA results, and export eligibility tied to that block are invalidated;
- unchanged blocks may retain valid state;
- span-level reconciliation inside changed blocks is deferred.

Every approval, rejection, tweak, generation, resume, and export request must include the expected document version. If the current version differs, the action is rejected and the UI reloads current state.

The MVP has no formal app-level undo/redo beyond normal browser/editor behavior. It still keeps document versions internally for invalidation, recovery, and debugging.

Autosave is required. Article/editor edits use debounced autosave; workflow transitions persist promptly.

---

## 6. Workflow Backend

The workflow is an explicit state graph whose state is backed by SQLite, not by transient memory. It supports cancellation and durable resume after user interruptions.

### Stages

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

### Nodes

**Structurer.** Parses raw prose into blocks/spans and detects low-level signals. Deterministic parsing should do as much work as possible; LLM use is for semantic signal detection.

**Analyst.** Proposes candidate interactions using structured output only. It must include target block/span IDs, pattern, rationale, required data, and whether a library component can represent the interaction.

**Critic.** Prunes candidates against the design rule. For every survivor it must answer: "what understanding is lost if this is removed?"

**Consent/Data Gap.** Pauses the workflow and persists state. The user approves/rejects/tweaks candidates and supplies missing data through built-in templates only.

**Spec Agent.** Converts each approved candidate into a concrete component spec: inputs, behavior, embedded data, fallback text, accessibility notes, and reduced-motion requirements.

**Builder.** Library-first. It must use audited/config-driven components whenever possible. Restricted bespoke generation is allowed only when no approved library component can satisfy the spec.

**Static Validator.** Enforces the restricted component subset. Static/security validation failures are hard blocks and cannot be overridden.

**Sandbox QA.** Builds/renders locally and reports runtime/basic accessibility warnings. QA warnings and runtime crashes warn but allow export after explicit user confirmation.

### Cancellation

The user can cancel running analysis/generation jobs. Cancellation stops further workflow progress, persists the canceled state, and keeps valid completed results if they match the current document version and have passed their relevant validation stage. Incomplete or invalid partial outputs are discarded or marked canceled.

### Repair loop

Restricted bespoke generation gets **3 automatic repair attempts** per component. After 3 failed attempts, the app asks the user whether to retry, fallback to a simpler audited component if one exists, drop the interaction, or keep text-only article content.

---

## 7. Model Providers

Provider calls go through one abstraction; nodes must not call vendor SDKs or CLIs directly.

```typescript
interface LLMProvider {
  name: string;
  mode: "cli" | "api";
  complete(messages: Msg[], opts: CallOpts): Promise<Result>;
  stream(messages: Msg[], opts: CallOpts): AsyncIterable<Chunk>;
  structured<T>(messages: Msg[], schema: Schema): Promise<T>;
  capabilities(): ProviderCapabilities;
}

interface ProviderCapabilities {
  structuredOutput: boolean;
  streaming: boolean;
  maxContextTokens?: number;
  models: string[];
}
```

The preferred auth mode for Claude/Codex is **AO-style local CLI login**:

- the user installs and signs into the provider CLI;
- the app uses that authenticated CLI if it can satisfy the required provider contract;
- the app does not need to store raw API keys for CLI-auth providers.

API-key/env configuration remains a fallback for direct provider API access or providers without suitable CLI support.

Structured output is required for critical nodes. A provider/model that cannot satisfy `structured(schema)` cannot be used for Analyst, Critic, Spec, Builder, or any other schema-dependent step. Best-effort JSON parsing is not acceptable for these critical calls.

The setup/startup flow must run a required provider preflight:

- auth works;
- selected model exists;
- structured output works;
- required context limits are acceptable;
- required streaming/tool-call behavior is available when needed.

The MVP does not include formal per-run prompt/provider/schema version tracking. This reduces scope but means old generations may be harder to reproduce after prompts, adapters, schemas, or model settings change.

LLM debugging data stored in SQLite should be structured inputs/outputs only: node inputs, validated structured outputs, errors, timings, and token/cost metadata where available. Avoid full raw provider request/response logs and unnecessary raw prompt storage.

---

## 8. Consent Gate and Data Gaps

The consent gate is a real workflow interrupt. The editor presents surviving candidates inline and in a side panel. The user can approve, reject, or tweak parameters.

Many interactions require data the prose does not contain. The MVP does **not** allow arbitrary formulas, user-authored expression strings, or natural-language-to-formula generation.

Instead, missing data uses **built-in predefined templates only**:

- templates are shipped with the app;
- templates are audited and schema-defined;
- users choose/fill template parameters;
- local user-defined templates are not supported in normal MVP usage.

Example:

```typescript
interface DataGapTemplate {
  id: string;
  name: string;
  appliesTo: InteractionPattern[];
  parameters: Schema;
  outputSchema: Schema;
}
```

This keeps generated interactions deterministic and prevents arbitrary formula execution.

---

## 9. Generation Strategy

Generation is hybrid, but **library-first**.

### Config-driven library generation

The default path is to select an audited component from the shared library and fill schema-validated props. This is deterministic and should cover the common MVP patterns.

Initial MVP patterns:

| Signal in prose | Interaction pattern | Library component |
|---|---|---|
| Numbers, rates, "if X then Y" | Reactive inline value | `ReactiveValue` |
| "X versus Y" comparison | Toggle or side-by-side view | `CompareToggle` |

### Restricted bespoke generation

Bespoke generation is allowed in MVP, but only as a restricted component subset.

Generated bespoke code must:

- use the approved scaffold/interface;
- import only approved internal helpers/packages;
- use schema-validated props and embedded data;
- include a text fallback;
- include basic accessibility metadata;
- respect reduced-motion requirements when animation exists;
- pass static validation before it can be considered exportable.

Generated bespoke code must not:

- use runtime network APIs: `fetch`, `XMLHttpRequest`, WebSocket, EventSource, remote module/asset loading;
- use browser storage APIs: `localStorage`, `sessionStorage`, IndexedDB, cookies;
- use dynamic code execution: `eval`, `new Function`, dynamic `import()`, runtime script injection, runtime code compilation;
- access or mutate host page DOM outside its own component/custom-element/shadow-root boundary;
- use raw HTML rendering such as Svelte `{@html ...}`;
- import external npm packages, arbitrary local files, remote modules, or dynamic paths;
- load external resources such as scripts, fonts, images, datasets, map tiles, or styles;
- register uncontrolled global listeners/timers.

State inside exported interactions is ephemeral in-memory state only. Reader choices may live while the page is open, but reset on reload.

Scoped event/timing APIs are allowed only when approved and cleaned up. Examples: local component events, `ResizeObserver` on the component root, or controlled `requestAnimationFrame` loops with teardown.

---

## 10. Component Library

The shared component library contains audited Svelte primitives. Each component must:

- expose a typed parameter schema;
- validate props before render;
- ship meaningful fallback text;
- avoid external resources;
- avoid runtime network and storage APIs;
- avoid raw HTML injection from user/article/LLM content;
- remain scoped to its own custom-element/shadow-root boundary;
- be keyboard-reachable for standard controls where feasible;
- respect `prefers-reduced-motion` when animation exists;
- clean up timers, observers, and event listeners.

Large speculative component breadth is not an MVP goal. Add patterns only when they prove useful in real articles.

---

## 11. Sandbox, Static Validation, and QA

The sandbox is a local preview/QA mechanism, not the only security boundary. Because bespoke code may be exported inline after QA, the primary enforceable boundary is the restricted component subset plus static validation.

### Sandbox renderer

Preview and QA use a locked-down local iframe communicating by `postMessage`.

```text
editor -> postMessage({ component, props, runId }) -> iframe
editor <- postMessage({ status, error?, warnings?, height }) <- iframe
```

The implementation must validate message origin, message shape, run IDs, and payload size. The iframe must use restrictive sandbox flags and CSP appropriate to local preview. Network and external-resource access must be blocked in preview/QA to match export constraints.

### Static validation

Static validation is a hard gate. Violations block preview/export eligibility and trigger the Builder repair loop.

Hard-blocked examples:

- network APIs;
- storage APIs;
- dynamic code execution;
- raw HTML rendering;
- host DOM access;
- disallowed imports;
- external resources;
- uncontrolled global listeners/timers.

There is no user override for static/security validation failures.

### QA

MVP QA performs non-visual checks only:

- component builds locally;
- component mounts;
- runtime errors/crashes are captured;
- fallback exists;
- obvious labels exist for standard controls where feasible;
- keyboard reachability is checked for standard controls where feasible;
- reduced-motion behavior is checked for components that animate.

MVP QA does not include screenshot or visual regression checks.

QA failures and runtime crashes **warn but allow export** after explicit user confirmation. QA warnings/failures are stored in SQLite for local history/debugging, but they are not included in the export manifest in MVP.

Resource controls are soft warnings in MVP, not hard limits. Warn for excessive build time, render time, props/data size, QA duration, or bundle size.

---

## 12. Export and Bundling

The MVP export is inline/static web-component export only. There is no iframe export in MVP.

Each export produces immutable/versioned artifacts:

- a JS bundle registering a unique custom-element tag;
- a required machine-readable manifest;
- a minimal standalone preview HTML file.

Example:

```html
<script src="./ia-article-a1b2c3.js"></script>
<ia-article-a1b2c3></ia-article-a1b2c3>
```

The tag name must be unique per export, e.g. `<ia-article-a1b2c3>`, to avoid collisions when multiple exported articles appear on the same host page.

Exports are immutable:

- every export creates a new artifact/version;
- existing export artifacts are never modified in place;
- there is no `latest` alias in MVP;
- editing an article after export creates a new document version and requires a new export.

The app supports both:

- downloadable/static files the user can host anywhere;
- optional serving of completed export artifacts from the local/self-hosted app.

The MVP includes no source maps in exported artifacts.

### Manifest

Every export includes a required manifest.

```typescript
interface ExportManifest {
  exportId: string;
  articleId: string;
  documentVersion: number;
  schemaVersion: string;
  createdAt: string;
  tagName: string;
  files: Array<{
    path: string;
    sha256: string;
    bytes: number;
  }>;
  componentLibraryVersion: string;
  interactions: Array<{
    id: string;
    blockIds: string[];
    mode: "library" | "restricted-bespoke";
    componentName?: string;
  }>;
}
```

The manifest records successful export metadata only. MVP does not record QA warning/failure status in the manifest.

### Cleanup

The app keeps the last 10 completed exports per article. Older completed export files are automatically deleted. Temporary build/QA artifacts are also cleaned automatically, while structured history remains in SQLite.

---

## 13. Platform Editor

The editor has five primary areas:

**Input/document pane.** The user writes or pastes prose. The MVP hard limit is 5,000 words. Articles above the limit are rejected until shortened or split.

**Touch-point review.** The user sees candidates highlighted at block/span locations with rationales and approve/reject/tweak controls.

**Data-gap dialogs.** Approved candidates with missing data must use built-in templates only.

**Preview pane.** The sandboxed local preview renders current valid components and reports warnings/errors.

**Debug/history view.** MVP includes a local debug/history view showing workflow status, node timings, errors, structured LLM inputs/outputs, QA warnings, cancellation status, and export history.

The frontend is not the source of truth. SQLite-backed server state is authoritative. Client actions include expected document versions and are rejected if stale.

---

## 14. Operational Requirements

The MVP must include `ia doctor`.

`ia doctor` checks:

- supported Node/package version;
- SQLite database path exists and is writable;
- schema migrations are current;
- selected provider CLI/API auth works;
- provider structured-output preflight passes;
- local build prerequisites are available;
- sandbox/browser dependencies are available;
- export/storage directories are writable.

The local app should track:

- workflow run IDs;
- node status/timings;
- structured validation results;
- QA warnings/failures;
- cancellation events;
- export records;
- token/cost metadata where providers expose it.

No formal token/cost budget controls are required in MVP beyond the hard 5,000-word article limit and the 3 repair-attempt cap.

---

## 15. MVP Threat Model

### Trusted

- audited platform code;
- audited component library;
- built-in data/formula templates;
- local SQLite database controlled by the user;
- local build toolchain installed by the user.

### Untrusted

- pasted article text;
- LLM outputs;
- generated bespoke component code;
- user-entered template parameters;
- host pages where exported articles are embedded;
- provider CLI/API behavior and output format changes.

### Security boundaries

- The editor runs trusted platform code only.
- Generated bespoke code is statically validated before preview/export eligibility.
- Preview/QA runs in a restricted local iframe.
- Exported inline code is constrained by the restricted component subset.
- Exported artifacts are self-contained and must not make runtime network calls.

### Explicit MVP restrictions

- no runtime network access in exported/generated article code;
- no external runtime resources;
- no browser storage APIs;
- no dynamic code execution;
- no raw HTML rendering from user/article/LLM content;
- no host DOM access;
- no arbitrary/external imports;
- no uncontrolled global listeners/timers;
- no arbitrary user formulas;
- no iframe export;
- no remote/LAN editor mode.

### Known residual risks

- QA warnings and runtime crashes can be overridden by the user during export.
- MVP does not include visual regression/screenshot checks.
- MVP does not include formal prompt/provider/schema version tracking.
- The localhost UI has no auth in MVP.
- Inline exported bespoke code still runs in the host page context, so static validation must be conservative.

---

## 16. Build Order

1. **Local shell of the product.** CLI setup/start, localhost-only SvelteKit app, SQLite initialization, `ia doctor`, and 5,000-word article input.
2. **Versioned document state.** Block parser, autosave, document versions, stale-action rejection, block-level invalidation.
3. **One library pattern end to end.** Implement `ReactiveValue`: Structurer -> Analyst -> Critic -> consent -> built-in template data gap if needed -> library Builder -> static validation -> sandbox QA -> immutable export.
4. **Export foundation.** Unique custom element tag, JS bundle, manifest, preview HTML, immutable export records, cleanup of old exports.
5. **Second library pattern.** Add `CompareToggle`.
6. **Debug/history and cancellation.** Expose run history, warnings, structured inputs/outputs, and cancellation behavior.
7. **Restricted bespoke generation.** Add scaffold, static validator, 3-attempt repair loop, QA warnings, and explicit user confirmation for warn-but-allow export.
8. **Critic hardening.** Build evaluation fixtures and tune prompts/provider behavior once the loop is observable.

---

## 17. Repository Structure

```text
/
|- packages/
|  |- components/        # audited Svelte interaction primitives
|  |- doc-model/         # ArticleDoc types, parser, block invalidation
|  |- bundler/           # approved doc -> immutable web-component export
|  |- validators/        # static restricted-subset validation
|  `- providers/         # CLI/API provider adapters and preflight checks
|- apps/
|  `- editor/            # localhost-only SvelteKit editor
|- backend/
|  |- graph/             # workflow graph and checkpoint integration
|  |- nodes/             # structurer, analyst, critic, spec, builder, qa
|  |- services/          # SQLite state, library lookup, sandbox client
|  `- prompts/           # current prompt files
|- cli/
|  `- ia                 # setup, doctor, start
|- sandbox/              # local iframe renderer and QA harness
`- migrations/           # SQLite migrations
```

---

## 18. Summary

The MVP is a single-user local/self-hosted application. SQLite is the authoritative state store. The workflow is versioned, autosaved, cancelable, and guarded against stale actions. Generation is library-first, with restricted bespoke components allowed only behind static validation and local sandbox QA. Security rules are explicit: no runtime network, no storage APIs, no dynamic execution, no raw HTML, no host DOM access, no arbitrary imports, and no external resources. Exports are immutable self-contained web-component artifacts with unique tag names, required manifests, and preview HTML. QA warnings can be exported only after explicit confirmation; static/security validation failures cannot be overridden.
