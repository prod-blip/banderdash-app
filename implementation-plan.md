# Interactive Article Platform Full MVP Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build the full MVP described in `interactive-article-platform-implementation.md`: a single-user local/self-hosted app that converts raw articles into approved interactive web-component exports.

**Architecture:** Use an npm workspace monorepo with a localhost-only SvelteKit editor, TypeScript workflow backend, SQLite state store, audited Svelte component library, provider abstraction, static validator, sandbox QA harness, and immutable web-component export pipeline. Build library-first generation first, then add restricted bespoke generation behind static validation and repair loops.

**Tech Stack:** npm workspaces, TypeScript, SvelteKit, Svelte custom elements, SQLite, Node CLI, Vitest, Playwright or browser-based QA harness where needed.

---

## Planning Notes

- Package manager: use `npm`, because the setup command in the product spec is already `npm install <package>` / `npx ia ...`, and npm keeps the install story familiar for the MVP.
- Source specification: `interactive-article-platform-implementation.md`.
- Working folder: `/Users/apple/Desktop/Atul Work/Github/banderdash-app`.
- This plan covers the full MVP, but execution should still happen in strict build order.
- Do not implement speculative features beyond the MVP: no hosted SaaS, no auth, no LAN mode, no iframe export, no user-defined formulas/templates, no editable project-file system, no external resources in exports.

---

## Global Acceptance Criteria

The MVP is complete when:

1. `npm install` works from repo root.
2. `npx ia setup`, `npx ia doctor`, and `npx ia start` exist.
3. The local editor binds to localhost only.
4. A user can paste an article up to 5,000 words.
5. Article state persists in SQLite with document versions and block-level invalidation.
6. The workflow can run Structurer -> Analyst -> Critic -> Consent/Data Gap -> Spec Agent -> Builder -> Static Validator -> Sandbox QA -> Export.
7. `ReactiveValue` works end-to-end as the first audited library pattern.
8. `CompareToggle` works as the second audited library pattern.
9. Generated exports include unique custom-element JS, manifest, and preview HTML.
10. Export artifacts are immutable and older completed exports are cleaned after the last 10 per article.
11. Debug/history shows workflow status, timings, structured inputs/outputs, errors, QA warnings, cancellation events, and export history.
12. Restricted bespoke generation is available only through approved scaffold, static validation, 3 repair attempts, sandbox QA, and explicit user confirmation for warn-but-allow export.
13. Static/security validation failures cannot be overridden.
14. Runtime QA warnings/crashes can be exported only after explicit confirmation.

---

## Phase 0: Repository and Tooling Foundation

### Task 0.1: Create npm workspace root

**Objective:** Set up the monorepo root so all packages/apps can be installed and tested together.

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `README.md`

**Step 1: Create root `package.json`**

Use npm workspaces:

```json
{
  "name": "banderdash-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*",
    "apps/*",
    "backend",
    "cli",
    "sandbox"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "doctor": "node cli/dist/ia.js doctor"
  },
  "devDependencies": {
    "@types/node": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

**Step 2: Create shared TypeScript config**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

**Step 3: Create `.gitignore`**

```gitignore
node_modules/
dist/
.svelte-kit/
build/
coverage/
.env
.env.*
*.db
*.db-shm
*.db-wal
exports/
.tmp/
.DS_Store
```

**Step 4: Verify**

Run:

```bash
npm install
npm test
```

Expected:

- install succeeds
- test command exits successfully even before workspace tests exist

**Step 5: Commit**

```bash
git add package.json tsconfig.base.json .gitignore README.md package-lock.json
git commit -m "chore: initialize npm workspace"
```

---

### Task 0.2: Create repository directory structure

**Objective:** Create the directories from the spec so future tasks have stable paths.

**Files:**
- Create directories under `packages/`, `apps/`, `backend/`, `cli/`, `sandbox/`, `migrations/`
- Create placeholder `.gitkeep` files where needed

**Step 1: Create directories**

```bash
mkdir -p packages/components/src
mkdir -p packages/doc-model/src
mkdir -p packages/bundler/src
mkdir -p packages/validators/src
mkdir -p packages/providers/src
mkdir -p apps/editor
mkdir -p backend/src/graph
mkdir -p backend/src/nodes
mkdir -p backend/src/services
mkdir -p backend/src/prompts
mkdir -p cli/src
mkdir -p sandbox/src
mkdir -p migrations
```

**Step 2: Add placeholder files**

```bash
touch packages/components/src/.gitkeep
# repeat for empty directories that git would otherwise ignore
```

**Step 3: Verify**

Run:

```bash
find packages apps backend cli sandbox migrations -maxdepth 3 -type d | sort
```

Expected: all planned folders are present.

**Step 4: Commit**

```bash
git add packages apps backend cli sandbox migrations
git commit -m "chore: create mvp repository structure"
```

---

## Phase 1: CLI Shell, Setup, Doctor, and Local Start

### Task 1.1: Create CLI package shell

**Objective:** Add the `ia` CLI with `setup`, `doctor`, and `start` commands as stubs.

**Files:**
- Create: `cli/package.json`
- Create: `cli/tsconfig.json`
- Create: `cli/src/ia.ts`
- Create: `cli/src/commands/setup.ts`
- Create: `cli/src/commands/doctor.ts`
- Create: `cli/src/commands/start.ts`
- Test: `cli/src/ia.test.ts`

**Step 1: Write failing CLI tests**

Test command parsing for `setup`, `doctor`, and `start`.

**Step 2: Implement minimal command dispatch**

`ia.ts` should:

- parse `process.argv[2]`
- dispatch to command modules
- print help for unknown commands
- exit non-zero for unknown commands

**Step 3: Add bin config**

`cli/package.json` should expose:

```json
{
  "bin": {
    "ia": "dist/ia.js"
  }
}
```

**Step 4: Verify**

Run:

```bash
npm run build -w cli
node cli/dist/ia.js setup
node cli/dist/ia.js doctor
node cli/dist/ia.js start --help
```

Expected: commands exist and print clear MVP stub output.

**Step 5: Commit**

```bash
git add cli
git commit -m "feat: add ia cli command shell"
```

---

### Task 1.2: Implement explicit setup config

**Objective:** Add `ia setup` to create local config without running during install/postinstall.

**Files:**
- Create: `cli/src/config.ts`
- Modify: `cli/src/commands/setup.ts`
- Test: `cli/src/config.test.ts`

**Step 1: Write tests**

Cover:

- default config path creation
- no raw API key required for CLI-auth provider mode
- config is JSON and local-only

**Step 2: Implement config writer**

Store local config under a repo-local or user-local app directory. Keep it simple for MVP, e.g. `.banderdash/config.json` in the app working directory unless later changed by user.

Config fields:

```ts
interface AppConfig {
  dbPath: string;
  exportDir: string;
  provider: {
    name: string;
    mode: "cli" | "api";
    model?: string;
  };
}
```

**Step 3: Verify**

Run:

```bash
node cli/dist/ia.js setup
```

Expected:

- prints config path
- creates config file
- does not ask for secrets unless explicit interactive setup is later added

**Step 4: Commit**

```bash
git add cli/src
 git commit -m "feat: add explicit setup config"
```

---

### Task 1.3: Implement `ia doctor` framework

**Objective:** Build doctor checks framework before individual checks are filled in.

**Files:**
- Modify: `cli/src/commands/doctor.ts`
- Create: `cli/src/doctor/checks.ts`
- Test: `cli/src/doctor/checks.test.ts`

**Step 1: Write tests**

Cover:

- check pass
- check fail
- output summary
- non-zero exit when required checks fail

**Step 2: Implement check interface**

```ts
interface DoctorCheck {
  id: string;
  label: string;
  required: boolean;
  run(): Promise<{ ok: boolean; message: string }>;
}
```

**Step 3: Add placeholder checks**

Initial checks:

- Node version
- config exists
- SQLite path writable
- migrations current
- provider auth/preflight
- local build prerequisites
- sandbox dependencies
- export dir writable

Unimplemented checks may return warnings only until their packages exist.

**Step 4: Verify**

Run:

```bash
node cli/dist/ia.js doctor
```

Expected: readable checklist with pass/fail/warn.

**Step 5: Commit**

```bash
git add cli/src
 git commit -m "feat: add doctor check framework"
```

---

### Task 1.4: Create localhost-only SvelteKit editor shell

**Objective:** Add a local web editor app that can be started by CLI.

**Files:**
- Create: `apps/editor/package.json`
- Create: `apps/editor/svelte.config.js`
- Create: `apps/editor/vite.config.ts`
- Create: `apps/editor/src/routes/+page.svelte`
- Create: `apps/editor/src/routes/+layout.svelte`
- Modify: `cli/src/commands/start.ts`

**Step 1: Scaffold SvelteKit app manually or with create-svelte**

Use SvelteKit with TypeScript.

**Step 2: Add placeholder editor page**

Page sections:

- Input/document pane
- Touch-point review
- Preview pane
- Debug/history
- Export

They can be non-functional placeholders in this task.

**Step 3: Implement `ia start`**

`ia start` should start SvelteKit dev server bound to `127.0.0.1` only.

**Step 4: Verify**

Run:

```bash
node cli/dist/ia.js start
```

Expected:

- starts local editor
- URL is localhost/127.0.0.1 only
- no LAN host binding

**Step 5: Commit**

```bash
git add apps/editor cli/src
 git commit -m "feat: add localhost editor shell"
```

---

## Phase 2: SQLite State and Document Model

### Task 2.1: Create SQLite service package

**Objective:** Add backend SQLite connection and migration runner.

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/services/db.ts`
- Create: `backend/src/services/migrations.ts`
- Create: `migrations/001_init.sql`
- Test: `backend/src/services/db.test.ts`

**Step 1: Choose SQLite library**

Use a stable Node SQLite package such as `better-sqlite3` unless install/platform issues appear during implementation.

**Step 2: Write migration test**

Test that migrations create expected tables and are idempotent.

**Step 3: Create initial schema**

Tables:

- `articles`
- `article_blocks`
- `article_versions`
- `workflow_runs`
- `workflow_events`
- `candidates`
- `approvals`
- `generated_specs`
- `validation_results`
- `qa_results`
- `exports`
- `llm_logs`

Keep columns minimal but include:

- IDs
- article/document version
- JSON payload where schema is still evolving
- timestamps

**Step 4: Verify**

Run:

```bash
npm test -w backend
```

Expected: migration test passes.

**Step 5: Commit**

```bash
git add backend migrations
 git commit -m "feat: add sqlite state store and migrations"
```

---

### Task 2.2: Create ArticleDoc types

**Objective:** Add shared document model matching the spec.

**Files:**
- Create: `packages/doc-model/package.json`
- Create: `packages/doc-model/tsconfig.json`
- Create: `packages/doc-model/src/types.ts`
- Create: `packages/doc-model/src/index.ts`
- Test: `packages/doc-model/src/types.test.ts`

**Step 1: Define types**

Implement:

- `ArticleDoc`
- `Block`
- `Span`
- `Signal`
- `SignalKind`
- `BlockType`

**Step 2: Add lightweight runtime validators**

Use either Zod or internal validators. Prefer Zod if used across structured provider schemas; otherwise keep simple.

**Step 3: Verify**

Run:

```bash
npm test -w @banderdash/doc-model
```

Expected: type/validation tests pass.

**Step 4: Commit**

```bash
git add packages/doc-model
 git commit -m "feat: add article document model"
```

---

### Task 2.3: Implement block parser and 5,000-word limit

**Objective:** Parse pasted prose into versioned blocks and reject over-limit input.

**Files:**
- Create: `packages/doc-model/src/parseBlocks.ts`
- Create: `packages/doc-model/src/wordCount.ts`
- Test: `packages/doc-model/src/parseBlocks.test.ts`
- Test: `packages/doc-model/src/wordCount.test.ts`

**Step 1: Write parser tests**

Cover:

- paragraphs
- headings
- simple lists
- quotes
- stable block IDs for same content where possible
- 5,000-word acceptance
- 5,001-word rejection

**Step 2: Implement deterministic parser**

Keep parser simple:

- split by blank lines
- detect markdown-style headings beginning with `#`
- detect quote blocks beginning with `>`
- detect list blocks beginning with `-`, `*`, or numbered list markers

**Step 3: Verify**

Run:

```bash
npm test -w @banderdash/doc-model
```

Expected: parser tests pass.

**Step 4: Commit**

```bash
git add packages/doc-model/src
 git commit -m "feat: parse article text into blocks"
```

---

### Task 2.4: Implement article persistence and versions

**Objective:** Save article documents in SQLite with version numbers.

**Files:**
- Create: `backend/src/services/articles.ts`
- Test: `backend/src/services/articles.test.ts`

**Step 1: Write tests**

Cover:

- create article
- update article creates new version
- latest materialized document loads correctly
- article over 5,000 words is rejected

**Step 2: Implement service**

Expose:

```ts
createArticle(rawText: string): Promise<ArticleDoc>
updateArticle(articleId: string, rawText: string, expectedVersion: number): Promise<ArticleDoc>
getArticle(articleId: string): Promise<ArticleDoc>
```

**Step 3: Verify**

Run:

```bash
npm test -w backend
```

Expected: article persistence tests pass.

**Step 4: Commit**

```bash
git add backend/src/services
 git commit -m "feat: persist versioned articles"
```

---

### Task 2.5: Implement stale-action rejection and block-level invalidation

**Objective:** Reject actions against stale document versions and invalidate generated state for changed blocks.

**Files:**
- Create: `packages/doc-model/src/invalidation.ts`
- Modify: `backend/src/services/articles.ts`
- Test: `packages/doc-model/src/invalidation.test.ts`
- Test: `backend/src/services/articles-invalidation.test.ts`

**Step 1: Write invalidation tests**

Cover:

- unchanged blocks retain state
- changed paragraph invalidates tied candidates/specs/QA/export eligibility
- changed heading invalidates tied state
- stale expected version rejects action

**Step 2: Implement block diffing**

For MVP, compare block text and type. Do not do span-level reconciliation.

**Step 3: Implement invalidation service hook**

On article update, mark rows tied to changed block IDs as invalidated.

**Step 4: Verify**

Run:

```bash
npm test -w packages/doc-model
npm test -w backend
```

Expected: invalidation tests pass.

**Step 5: Commit**

```bash
git add packages/doc-model backend/src/services
 git commit -m "feat: add block-level invalidation"
```

---

## Phase 3: Editor Input and Autosave

### Task 3.1: Add editor API routes

**Objective:** Connect SvelteKit editor to backend article services.

**Files:**
- Create: `apps/editor/src/routes/api/articles/+server.ts`
- Create: `apps/editor/src/routes/api/articles/[id]/+server.ts`
- Modify: `apps/editor/package.json`

**Step 1: Add backend dependency to editor**

The editor should import backend services through workspace package paths.

**Step 2: Implement API routes**

Routes:

- `POST /api/articles` create article
- `GET /api/articles/:id` load article
- `PUT /api/articles/:id` update article with expected version

**Step 3: Verify manually**

Run editor and use curl:

```bash
curl -X POST http://127.0.0.1:5173/api/articles \
  -H 'content-type: application/json' \
  -d '{"rawText":"# Test\n\nA paragraph."}'
```

Expected: JSON response includes article ID, version, blocks, word count.

**Step 4: Commit**

```bash
git add apps/editor
 git commit -m "feat: add article api routes"
```

---

### Task 3.2: Implement input pane with debounced autosave

**Objective:** Let user paste/edit prose and persist it with version handling.

**Files:**
- Modify: `apps/editor/src/routes/+page.svelte`
- Create: `apps/editor/src/lib/api/articles.ts`
- Create: `apps/editor/src/lib/stores/article.ts`

**Step 1: Implement UI**

Add:

- textarea/editor input
- word count display
- save status
- version display
- over-limit error

**Step 2: Implement debounced autosave**

Autosave after short idle delay. Include expected document version on update.

**Step 3: Handle stale response**

If stale version error occurs:

- show message
- reload current article state
- do not overwrite silently

**Step 4: Verify**

Manual test:

- paste article
- see autosave status
- reload page and confirm content persists
- paste 5,001+ words and confirm rejection

**Step 5: Commit**

```bash
git add apps/editor/src
 git commit -m "feat: add article input autosave"
```

---

## Phase 4: Provider Abstraction and Preflight

### Task 4.1: Create provider package interfaces

**Objective:** Add provider abstraction required by all workflow nodes.

**Files:**
- Create: `packages/providers/package.json`
- Create: `packages/providers/tsconfig.json`
- Create: `packages/providers/src/types.ts`
- Create: `packages/providers/src/index.ts`
- Test: `packages/providers/src/types.test.ts`

**Step 1: Define provider interfaces**

Implement:

- `LLMProvider`
- `ProviderCapabilities`
- `Msg`
- `CallOpts`
- `Result`
- `Chunk`
- `Schema`

**Step 2: Add fake provider for tests**

Create deterministic fake provider implementing structured output.

**Step 3: Verify**

Run:

```bash
npm test -w @banderdash/providers
```

Expected: fake provider tests pass.

**Step 4: Commit**

```bash
git add packages/providers
 git commit -m "feat: add llm provider abstraction"
```

---

### Task 4.2: Add provider preflight checks

**Objective:** Ensure selected provider can satisfy MVP requirements before workflow runs.

**Files:**
- Create: `packages/providers/src/preflight.ts`
- Modify: `cli/src/doctor/checks.ts`
- Test: `packages/providers/src/preflight.test.ts`

**Step 1: Write preflight tests using fake provider**

Cover:

- auth check pass/fail
- model exists
- structured output required
- streaming capability check when needed
- context limit check

**Step 2: Implement `runProviderPreflight`**

Return structured result with pass/fail/warn.

**Step 3: Wire into `ia doctor`**

Doctor must fail required provider checks when a real provider is configured and unavailable.

**Step 4: Verify**

Run:

```bash
node cli/dist/ia.js doctor
```

Expected: provider section appears.

**Step 5: Commit**

```bash
git add packages/providers cli/src
 git commit -m "feat: add provider preflight checks"
```

---

### Task 4.3: Implement first real provider adapter behind interface

**Objective:** Add one usable provider adapter without letting workflow nodes call vendor APIs directly.

**Files:**
- Create: `packages/providers/src/adapters/openai.ts` or `packages/providers/src/adapters/anthropic.ts`
- Modify: `packages/providers/src/index.ts`
- Test: `packages/providers/src/adapters/*.test.ts`

**Important:** Do not hard-code secrets. Use environment/config only.

**Step 1: Choose adapter during implementation**

Prefer the provider that is easiest to verify in the user environment. If no provider credential/CLI is available, keep fake provider for local development and make real provider config explicit.

**Step 2: Implement adapter**

Must support:

- `complete`
- `stream` if available
- `structured`
- `capabilities`

**Step 3: Add doctor check**

Verify auth/model/structured output.

**Step 4: Verify**

Run:

```bash
node cli/dist/ia.js doctor
```

Expected: selected provider passes preflight or shows actionable failure.

**Step 5: Commit**

```bash
git add packages/providers cli/src
 git commit -m "feat: add first real provider adapter"
```

---

## Phase 5: Workflow Graph and Node Logging

### Task 5.1: Create workflow graph primitives

**Objective:** Add explicit graph-style workflow state machine backed by SQLite.

**Files:**
- Create: `backend/src/graph/types.ts`
- Create: `backend/src/graph/runner.ts`
- Create: `backend/src/services/workflowRuns.ts`
- Test: `backend/src/graph/runner.test.ts`

**Step 1: Define graph types**

Stages:

- Structurer
- Analyst
- Critic
- ConsentDataGap
- SpecAgent
- Builder
- StaticValidator
- SandboxQA
- Export

Statuses:

- pending
- running
- waiting_for_user
- completed
- failed
- canceled

**Step 2: Implement run persistence**

Every stage transition writes `workflow_runs` and `workflow_events`.

**Step 3: Verify**

Run tests with fake nodes.

Expected: workflow resumes from persisted state.

**Step 4: Commit**

```bash
git add backend/src/graph backend/src/services
 git commit -m "feat: add persisted workflow graph runner"
```

---

### Task 5.2: Add cancellation support

**Objective:** Let running workflows be canceled and persisted safely.

**Files:**
- Modify: `backend/src/graph/runner.ts`
- Create: `backend/src/services/cancellation.ts`
- Test: `backend/src/graph/cancellation.test.ts`

**Step 1: Write cancellation tests**

Cover:

- cancel pending run
- cancel running run between stages
- keep completed valid outputs
- mark incomplete outputs canceled/discarded

**Step 2: Implement cancellation checks**

Runner checks cancellation before and after each node.

**Step 3: Verify**

Run:

```bash
npm test -w backend
```

Expected: cancellation tests pass.

**Step 4: Commit**

```bash
git add backend/src
 git commit -m "feat: add workflow cancellation"
```

---

### Task 5.3: Add structured LLM/debug logging

**Objective:** Store structured node inputs/outputs, timing, errors, and token/cost metadata where available.

**Files:**
- Create: `backend/src/services/llmLogs.ts`
- Modify: workflow node execution wrapper
- Test: `backend/src/services/llmLogs.test.ts`

**Step 1: Write tests**

Cover:

- store structured input
- store validated structured output
- store error/timing
- avoid raw provider request/response dumps

**Step 2: Implement logging service**

Fields:

- run ID
- node name
- article ID
- document version
- structured input JSON
- structured output JSON
- error JSON
- timing
- token/cost metadata if available

**Step 3: Verify**

Run backend tests.

**Step 4: Commit**

```bash
git add backend/src/services
 git commit -m "feat: add structured workflow logging"
```

---

## Phase 6: Structurer, Analyst, Critic, and Consent

### Task 6.1: Implement Structurer node

**Objective:** Convert raw article into blocks/spans/signals.

**Files:**
- Create: `backend/src/nodes/structurer.ts`
- Test: `backend/src/nodes/structurer.test.ts`

**Step 1: Write tests**

Cover deterministic signals:

- quantity
- comparison
- sequence
- quote/list/heading parsing passthrough

**Step 2: Implement deterministic signal detection**

Use regex/simple heuristics for MVP:

- numbers/rates -> `quantity`
- versus/compared to/more than/less than -> `comparison`
- first/second/finally/then -> `sequence`

LLM semantic detection can be added later through provider if needed, but deterministic work should do as much as possible.

**Step 3: Persist results**

Store parsed blocks/spans/signals tied to article version.

**Step 4: Verify**

Run backend tests.

**Step 5: Commit**

```bash
git add backend/src/nodes
 git commit -m "feat: add structurer node"
```

---

### Task 6.2: Define candidate interaction schema

**Objective:** Add strongly typed candidate outputs for Analyst and Critic.

**Files:**
- Create: `backend/src/nodes/schemas/candidate.ts`
- Test: `backend/src/nodes/schemas/candidate.test.ts`

**Step 1: Define schema**

Candidate fields:

- `id`
- `articleId`
- `documentVersion`
- `blockIds`
- `spanIds`
- `pattern`
- `rationale`
- `requiredData`
- `libraryRepresentable`
- `understandingLossIfRemoved`
- `status`

**Step 2: Add validation tests**

Reject missing block IDs, unsupported pattern, missing rationale.

**Step 3: Verify**

Run backend tests.

**Step 4: Commit**

```bash
git add backend/src/nodes/schemas
 git commit -m "feat: add interaction candidate schema"
```

---

### Task 6.3: Implement Analyst node with structured output

**Objective:** Propose candidate interactions from structured article signals.

**Files:**
- Create: `backend/src/nodes/analyst.ts`
- Create: `backend/src/prompts/analyst.md`
- Test: `backend/src/nodes/analyst.test.ts`

**Step 1: Write tests with fake provider**

Cover:

- candidate includes block/span IDs
- candidate includes pattern
- candidate includes rationale
- unsupported provider without structured output fails

**Step 2: Implement Analyst**

Use provider `structured(schema)` only. No best-effort JSON parsing.

**Step 3: Persist candidates**

Store candidates in SQLite tied to article version and blocks.

**Step 4: Verify**

Run backend tests.

**Step 5: Commit**

```bash
git add backend/src/nodes backend/src/prompts
 git commit -m "feat: add analyst node"
```

---

### Task 6.4: Implement Critic node

**Objective:** Prune candidates using the rule: interaction must enact meaning, not decorate it.

**Files:**
- Create: `backend/src/nodes/critic.ts`
- Create: `backend/src/prompts/critic.md`
- Test: `backend/src/nodes/critic.test.ts`

**Step 1: Write tests**

Cover:

- decorative candidate is rejected
- candidate without clear understanding loss is rejected
- survivor includes answer to: what understanding is lost if removed?

**Step 2: Implement Critic**

Use provider structured output only.

**Step 3: Persist critic decisions**

Mark candidates as `survived` or `rejected_by_critic`.

**Step 4: Verify**

Run backend tests.

**Step 5: Commit**

```bash
git add backend/src/nodes backend/src/prompts
 git commit -m "feat: add critic node"
```

---

### Task 6.5: Build consent API and UI

**Objective:** Pause workflow for user approval/rejection/tweaks.

**Files:**
- Create: `apps/editor/src/routes/api/workflows/[runId]/candidates/+server.ts`
- Create: `apps/editor/src/routes/api/workflows/[runId]/approvals/+server.ts`
- Modify: `apps/editor/src/routes/+page.svelte`
- Create: `apps/editor/src/lib/components/CandidateReview.svelte`

**Step 1: Implement API**

Endpoints:

- get surviving candidates
- approve candidate
- reject candidate
- tweak approved candidate parameters

Every action must include expected document version.

**Step 2: Implement UI**

Show candidates inline/side-panel with:

- block text
- rationale
- understanding loss if removed
- approve/reject/tweak controls

**Step 3: Verify**

Manual test:

- run workflow to consent pause
- approve/reject candidates
- edit article and confirm stale actions are rejected

**Step 4: Commit**

```bash
git add apps/editor backend/src
 git commit -m "feat: add candidate consent review"
```

---

## Phase 7: Data Gap Templates

### Task 7.1: Define data gap template system

**Objective:** Support built-in audited templates only.

**Files:**
- Create: `backend/src/services/dataGapTemplates.ts`
- Create: `backend/src/nodes/schemas/dataGapTemplate.ts`
- Test: `backend/src/services/dataGapTemplates.test.ts`

**Step 1: Define template interface**

Implement `DataGapTemplate` from the spec.

**Step 2: Add built-in template registry**

Start with templates needed for `ReactiveValue`, such as:

- numeric variable input
- rate/percentage input
- simple scenario parameter set

No arbitrary formula strings.

**Step 3: Verify**

Run tests proving only built-in templates are available.

**Step 4: Commit**

```bash
git add backend/src/services backend/src/nodes/schemas
 git commit -m "feat: add built-in data gap templates"
```

---

### Task 7.2: Build data gap UI

**Objective:** Let users supply missing data through built-in templates.

**Files:**
- Create: `apps/editor/src/lib/components/DataGapDialog.svelte`
- Create: `apps/editor/src/routes/api/workflows/[runId]/data-gaps/+server.ts`
- Modify: `apps/editor/src/routes/+page.svelte`

**Step 1: Implement API**

Endpoints:

- list data gaps for approved candidates
- submit template values

Include expected document version.

**Step 2: Implement UI**

Show template name, fields, validation errors, and save status.

**Step 3: Verify**

Manual test:

- approve candidate requiring data
- dialog appears
- invalid input rejected
- valid input persists

**Step 4: Commit**

```bash
git add apps/editor backend/src
 git commit -m "feat: add data gap template flow"
```

---

## Phase 8: Component Library Pattern 1 - ReactiveValue

### Task 8.1: Create components package and schema registry

**Objective:** Add audited component package infrastructure.

**Files:**
- Create: `packages/components/package.json`
- Create: `packages/components/tsconfig.json`
- Create: `packages/components/src/registry.ts`
- Create: `packages/components/src/types.ts`
- Test: `packages/components/src/registry.test.ts`

**Step 1: Define component registry types**

Each component entry includes:

- name
- pattern
- prop schema
- fallback generator
- Svelte component path

**Step 2: Add empty registry test**

Verify lookup by pattern/name.

**Step 3: Verify**

Run components tests.

**Step 4: Commit**

```bash
git add packages/components
 git commit -m "feat: add audited component registry"
```

---

### Task 8.2: Implement `ReactiveValue` audited component

**Objective:** Build the first library-first interaction primitive.

**Files:**
- Create: `packages/components/src/ReactiveValue.svelte`
- Create: `packages/components/src/reactiveValue.schema.ts`
- Create: `packages/components/src/reactiveValue.test.ts`
- Modify: `packages/components/src/registry.ts`

**Step 1: Write schema tests**

Cover:

- valid numeric props
- invalid formula rejected
- fallback text required

**Step 2: Implement component**

Component behavior:

- accepts schema-validated props
- displays article text with reactive inline value
- lets reader adjust approved numeric parameters
- no network/storage/dynamic code/raw HTML
- includes fallback text
- keyboard reachable

**Step 3: Register component**

Pattern: `reactive_value`.

**Step 4: Verify**

Run:

```bash
npm test -w @banderdash/components
```

Expected: tests pass.

**Step 5: Commit**

```bash
git add packages/components/src
 git commit -m "feat: add ReactiveValue component"
```

---

## Phase 9: Spec Agent and Library Builder

### Task 9.1: Define component spec schema

**Objective:** Add concrete interaction spec format consumed by Builder.

**Files:**
- Create: `backend/src/nodes/schemas/componentSpec.ts`
- Test: `backend/src/nodes/schemas/componentSpec.test.ts`

**Step 1: Define schema**

Spec fields:

- `id`
- `candidateId`
- `mode`
- `componentName`
- `props`
- `embeddedData`
- `fallbackText`
- `accessibilityNotes`
- `reducedMotionRequirements`

**Step 2: Add validation tests**

Reject missing fallback, unsupported component, invalid props.

**Step 3: Verify**

Run backend tests.

**Step 4: Commit**

```bash
git add backend/src/nodes/schemas
 git commit -m "feat: add component spec schema"
```

---

### Task 9.2: Implement Spec Agent

**Objective:** Convert approved candidates into concrete component specs.

**Files:**
- Create: `backend/src/nodes/specAgent.ts`
- Create: `backend/src/prompts/spec-agent.md`
- Test: `backend/src/nodes/specAgent.test.ts`

**Step 1: Write tests using fake provider**

Cover:

- approved `ReactiveValue` candidate becomes valid spec
- missing fallback rejected
- invalid props rejected

**Step 2: Implement Spec Agent**

Use provider structured output only.

**Step 3: Persist generated specs**

Store specs tied to article version and candidates.

**Step 4: Verify**

Run backend tests.

**Step 5: Commit**

```bash
git add backend/src/nodes backend/src/prompts
 git commit -m "feat: add spec agent"
```

---

### Task 9.3: Implement library Builder

**Objective:** Convert valid specs into library component render/export units.

**Files:**
- Create: `backend/src/nodes/builder.ts`
- Create: `backend/src/services/libraryLookup.ts`
- Test: `backend/src/nodes/builder.test.ts`

**Step 1: Write tests**

Cover:

- valid `ReactiveValue` spec selects audited component
- invalid props fail
- unsupported component fails unless bespoke is enabled later

**Step 2: Implement Builder**

Library-first only in this task.

**Step 3: Verify**

Run backend tests.

**Step 4: Commit**

```bash
git add backend/src
 git commit -m "feat: add library-first builder"
```

---

## Phase 10: Static Validator

### Task 10.1: Create validators package

**Objective:** Add static validation infrastructure for restricted component subset.

**Files:**
- Create: `packages/validators/package.json`
- Create: `packages/validators/tsconfig.json`
- Create: `packages/validators/src/types.ts`
- Create: `packages/validators/src/index.ts`
- Test: `packages/validators/src/index.test.ts`

**Step 1: Define result type**

```ts
interface ValidationResult {
  ok: boolean;
  hardFailures: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
}
```

**Step 2: Add empty validator tests**

Verify pass/fail result shape.

**Step 3: Commit**

```bash
git add packages/validators
 git commit -m "feat: add static validator package"
```

---

### Task 10.2: Implement restricted-subset static checks

**Objective:** Hard-block unsafe generated/bespoke code and validate library specs.

**Files:**
- Create: `packages/validators/src/restrictedSubset.ts`
- Test: `packages/validators/src/restrictedSubset.test.ts`
- Create: `backend/src/nodes/staticValidator.ts`
- Test: `backend/src/nodes/staticValidator.test.ts`

**Step 1: Write hard-block tests**

Reject code containing:

- `fetch`
- `XMLHttpRequest`
- `WebSocket`
- `EventSource`
- `localStorage`
- `sessionStorage`
- `indexedDB`
- `document.cookie`
- `eval`
- `new Function`
- dynamic `import(`
- `{@html`
- `document.querySelector`
- `window.parent`
- external imports
- remote URLs
- unscoped global listeners/timers

**Step 2: Implement validator**

Use AST parsing where feasible. Regex-only validation is acceptable only as an initial conservative layer; do not rely on weak checks for final bespoke code if AST can be used.

**Step 3: Wire Static Validator node**

Persist validation results. Hard failures block preview/export eligibility.

**Step 4: Verify**

Run validator and backend tests.

**Step 5: Commit**

```bash
git add packages/validators backend/src/nodes
 git commit -m "feat: enforce restricted component subset"
```

---

## Phase 11: Sandbox Preview and QA

### Task 11.1: Create sandbox renderer shell

**Objective:** Add locked-down local iframe renderer for preview/QA.

**Files:**
- Create: `sandbox/package.json`
- Create: `sandbox/tsconfig.json`
- Create: `sandbox/src/renderer.ts`
- Create: `apps/editor/src/lib/components/SandboxPreview.svelte`

**Step 1: Implement iframe shell**

Use iframe sandbox flags and CSP appropriate to local preview.

**Step 2: Implement postMessage protocol**

Messages:

- editor -> iframe: `{ component, props, runId }`
- iframe -> editor: `{ status, error?, warnings?, height, runId }`

Validate:

- origin
- shape
- run ID
- payload size

**Step 3: Verify manually**

Preview a simple component and confirm status returns.

**Step 4: Commit**

```bash
git add sandbox apps/editor/src
 git commit -m "feat: add sandbox preview renderer"
```

---

### Task 11.2: Implement QA harness

**Objective:** Run non-visual QA checks for components.

**Files:**
- Create: `backend/src/nodes/sandboxQA.ts`
- Create: `backend/src/services/qaResults.ts`
- Test: `backend/src/nodes/sandboxQA.test.ts`

**Step 1: Write QA tests**

Cover:

- component builds
- component mounts
- runtime error captured
- fallback exists
- basic labels warning
- keyboard reachability warning for standard controls
- reduced-motion warning when component animates without support

**Step 2: Implement QA node**

QA warnings/failures are persisted but are not static-security failures.

**Step 3: Implement warn-but-allow policy**

Export requires explicit user confirmation if QA warnings/crashes exist.

**Step 4: Verify**

Run backend tests.

**Step 5: Commit**

```bash
git add backend/src
 git commit -m "feat: add sandbox qa checks"
```

---

## Phase 12: Export and Bundling

### Task 12.1: Create bundler package shell

**Objective:** Add package for immutable web-component exports.

**Files:**
- Create: `packages/bundler/package.json`
- Create: `packages/bundler/tsconfig.json`
- Create: `packages/bundler/src/types.ts`
- Create: `packages/bundler/src/index.ts`
- Test: `packages/bundler/src/types.test.ts`

**Step 1: Define export types**

Implement `ExportManifest` from spec.

**Step 2: Add manifest validation test**

Verify required fields.

**Step 3: Commit**

```bash
git add packages/bundler
 git commit -m "feat: add export bundler package"
```

---

### Task 12.2: Generate unique custom element tag

**Objective:** Ensure each export has a collision-resistant custom element tag.

**Files:**
- Create: `packages/bundler/src/tagName.ts`
- Test: `packages/bundler/src/tagName.test.ts`

**Step 1: Write tests**

Cover:

- tag starts with `ia-article-`
- tag is valid custom element name
- repeated exports generate different tags

**Step 2: Implement tag generator**

Use export ID hash or random suffix.

**Step 3: Verify**

Run bundler tests.

**Step 4: Commit**

```bash
git add packages/bundler/src
 git commit -m "feat: generate unique export tag names"
```

---

### Task 12.3: Build immutable export artifacts

**Objective:** Export JS bundle, manifest, and preview HTML.

**Files:**
- Create: `packages/bundler/src/buildExport.ts`
- Create: `packages/bundler/src/manifest.ts`
- Create: `packages/bundler/src/previewHtml.ts`
- Test: `packages/bundler/src/buildExport.test.ts`
- Create: `backend/src/nodes/exportNode.ts`
- Create: `backend/src/services/exports.ts`

**Step 1: Write export tests**

Cover:

- creates JS file
- creates manifest
- creates preview HTML
- computes sha256 and bytes
- no source maps
- immutable path per export

**Step 2: Implement bundler**

Compile approved article + components into custom element bundle.

**Step 3: Implement export node**

Preconditions:

- static validation passed
- QA results present
- if QA warnings/crashes exist, explicit confirmation present
- current document version matches expected version

**Step 4: Verify**

Run tests and manually export one article.

**Step 5: Commit**

```bash
git add packages/bundler backend/src
 git commit -m "feat: export immutable web component artifacts"
```

---

### Task 12.4: Implement export cleanup

**Objective:** Keep last 10 completed exports per article and clean temp artifacts.

**Files:**
- Create: `packages/bundler/src/cleanup.ts`
- Modify: `backend/src/services/exports.ts`
- Test: `packages/bundler/src/cleanup.test.ts`
- Test: `backend/src/services/exports-cleanup.test.ts`

**Step 1: Write cleanup tests**

Cover:

- 10 latest completed exports kept
- older completed exports deleted
- temporary build/QA artifacts deleted
- SQLite structured history remains

**Step 2: Implement cleanup**

Run cleanup after successful export and on app start if safe.

**Step 3: Verify**

Run tests.

**Step 4: Commit**

```bash
git add packages/bundler backend/src/services
 git commit -m "feat: cleanup old export artifacts"
```

---

## Phase 13: End-to-End ReactiveValue Flow

### Task 13.1: Wire workflow start API and UI

**Objective:** Let user start analysis/generation flow from editor.

**Files:**
- Create: `apps/editor/src/routes/api/workflows/+server.ts`
- Create: `apps/editor/src/routes/api/workflows/[runId]/+server.ts`
- Modify: `apps/editor/src/routes/+page.svelte`
- Create: `apps/editor/src/lib/stores/workflow.ts`

**Step 1: Implement start endpoint**

Input:

- article ID
- expected document version

Starts workflow through Structurer -> Analyst -> Critic and pauses at Consent/Data Gap.

**Step 2: Add UI button**

Button: `Analyze article`.

**Step 3: Add status display**

Show current stage and status.

**Step 4: Verify manually**

- paste article with numeric/if-then content
- click analyze
- candidates appear

**Step 5: Commit**

```bash
git add apps/editor backend/src
 git commit -m "feat: start article workflow from editor"
```

---

### Task 13.2: Continue workflow after consent/data gaps

**Objective:** Generate spec, build, validate, QA, and prepare export after user approval.

**Files:**
- Create: `apps/editor/src/routes/api/workflows/[runId]/resume/+server.ts`
- Modify: workflow runner
- Modify: editor UI

**Step 1: Implement resume endpoint**

Resume from waiting state after all required approvals/data gaps are complete.

**Step 2: Wire nodes**

Run:

- Spec Agent
- Builder
- Static Validator
- Sandbox QA

**Step 3: Verify manually**

- approve `ReactiveValue`
- provide template data if required
- resume workflow
- preview appears

**Step 4: Commit**

```bash
git add apps/editor backend/src
 git commit -m "feat: resume workflow after consent"
```

---

### Task 13.3: Add export UI

**Objective:** Let user export valid article artifact.

**Files:**
- Create: `apps/editor/src/lib/components/ExportPanel.svelte`
- Create: `apps/editor/src/routes/api/articles/[id]/exports/+server.ts`
- Modify: `apps/editor/src/routes/+page.svelte`

**Step 1: Implement export API**

Requires:

- article ID
- workflow run ID
- expected document version
- explicit QA warning confirmation if needed

**Step 2: Implement export panel**

Show:

- export eligibility
- static validation failures
- QA warnings
- confirmation checkbox if warnings/crashes exist
- export button
- export file list after success

**Step 3: Verify manually**

Export a `ReactiveValue` article and open preview HTML locally.

**Step 4: Commit**

```bash
git add apps/editor/src
 git commit -m "feat: add export ui"
```

---

## Phase 14: Component Library Pattern 2 - CompareToggle

### Task 14.1: Implement `CompareToggle` component

**Objective:** Add the second audited library component.

**Files:**
- Create: `packages/components/src/CompareToggle.svelte`
- Create: `packages/components/src/compareToggle.schema.ts`
- Create: `packages/components/src/compareToggle.test.ts`
- Modify: `packages/components/src/registry.ts`

**Step 1: Write tests**

Cover:

- valid A/B comparison props
- fallback required
- no raw HTML
- keyboard reachable toggle

**Step 2: Implement component**

Reader can toggle or compare side-by-side between two states/options.

**Step 3: Register pattern**

Pattern: `compare_toggle`.

**Step 4: Verify**

Run components tests.

**Step 5: Commit**

```bash
git add packages/components/src
 git commit -m "feat: add CompareToggle component"
```

---

### Task 14.2: Wire CompareToggle through Analyst, Spec Agent, Builder, and export

**Objective:** Make comparison prose produce exportable `CompareToggle` interactions.

**Files:**
- Modify: `backend/src/nodes/analyst.ts`
- Modify: `backend/src/nodes/specAgent.ts`
- Modify: `backend/src/nodes/builder.ts`
- Test: `backend/src/nodes/compareToggle-flow.test.ts`

**Step 1: Write integration test**

Input article contains `X versus Y` or comparison language.

Expected:

- Analyst proposes `compare_toggle`
- Critic keeps meaningful candidate
- Spec Agent creates valid props
- Builder selects `CompareToggle`
- Static validation passes

**Step 2: Implement node updates**

Add pattern routing and schema validation.

**Step 3: Verify manually**

Paste comparison article and export.

**Step 4: Commit**

```bash
git add backend/src packages/components/src
 git commit -m "feat: wire CompareToggle end to end"
```

---

## Phase 15: Debug/History and Cancellation UI

### Task 15.1: Build debug/history API

**Objective:** Expose workflow history and logs to the editor.

**Files:**
- Create: `apps/editor/src/routes/api/debug/articles/[id]/+server.ts`
- Create: `backend/src/services/debugHistory.ts`
- Test: `backend/src/services/debugHistory.test.ts`

**Step 1: Implement query service**

Return:

- workflow runs
- node statuses/timings
- structured inputs/outputs
- errors
- QA warnings
- cancellation events
- export records

**Step 2: Verify**

Run service tests.

**Step 3: Commit**

```bash
git add backend/src/services apps/editor/src/routes/api/debug
 git commit -m "feat: expose debug history api"
```

---

### Task 15.2: Build debug/history UI

**Objective:** Add local debug/history view in editor.

**Files:**
- Create: `apps/editor/src/lib/components/DebugHistory.svelte`
- Modify: `apps/editor/src/routes/+page.svelte`

**Step 1: Implement UI**

Show collapsible sections for:

- run status
- node timings
- structured LLM input/output
- errors
- QA warnings
- cancellations
- exports

**Step 2: Verify manually**

Run a workflow and confirm debug view updates.

**Step 3: Commit**

```bash
git add apps/editor/src
 git commit -m "feat: add debug history view"
```

---

### Task 15.3: Build cancellation UI

**Objective:** Let user cancel running workflows safely.

**Files:**
- Create: `apps/editor/src/routes/api/workflows/[runId]/cancel/+server.ts`
- Modify: `apps/editor/src/lib/stores/workflow.ts`
- Modify: `apps/editor/src/routes/+page.svelte`

**Step 1: Implement cancel endpoint**

Call backend cancellation service.

**Step 2: Add UI button**

Show Cancel only while workflow is running.

**Step 3: Verify manually**

Start workflow, cancel it, confirm state persists and completed valid results remain.

**Step 4: Commit**

```bash
git add apps/editor/src backend/src
 git commit -m "feat: add workflow cancellation ui"
```

---

## Phase 16: Restricted Bespoke Generation

### Task 16.1: Define bespoke component scaffold

**Objective:** Create approved scaffold/interface for restricted generated components.

**Files:**
- Create: `backend/src/nodes/bespoke/scaffold.ts`
- Create: `backend/src/nodes/bespoke/types.ts`
- Test: `backend/src/nodes/bespoke/scaffold.test.ts`

**Step 1: Define scaffold contract**

Generated component must include:

- approved imports only
- schema-validated props
- fallback text
- accessibility metadata
- reduced-motion handling if animation exists

**Step 2: Write tests**

Verify scaffold output shape.

**Step 3: Commit**

```bash
git add backend/src/nodes/bespoke
 git commit -m "feat: add bespoke component scaffold"
```

---

### Task 16.2: Add bespoke generation node path

**Objective:** Allow Builder to generate restricted bespoke component only when library cannot satisfy spec.

**Files:**
- Modify: `backend/src/nodes/builder.ts`
- Create: `backend/src/nodes/bespoke/generator.ts`
- Create: `backend/src/prompts/bespoke-builder.md`
- Test: `backend/src/nodes/bespoke/generator.test.ts`

**Step 1: Write tests**

Cover:

- library component preferred when available
- bespoke path used only when no library component matches
- provider structured output required
- generated code must go to static validation

**Step 2: Implement generator**

Use provider structured output. Do not execute generated code in this node.

**Step 3: Verify**

Run backend tests.

**Step 4: Commit**

```bash
git add backend/src/nodes backend/src/prompts
 git commit -m "feat: add restricted bespoke generation path"
```

---

### Task 16.3: Implement 3-attempt repair loop

**Objective:** Repair static validation/build failures up to 3 times, then ask user.

**Files:**
- Create: `backend/src/nodes/bespoke/repairLoop.ts`
- Modify: `backend/src/nodes/builder.ts`
- Test: `backend/src/nodes/bespoke/repairLoop.test.ts`

**Step 1: Write repair tests**

Cover:

- succeeds on first attempt
- repairs after validation failure
- stops after 3 failed attempts
- returns user decision options after failure

Options after 3 failures:

- retry
- fallback to simpler audited component if one exists
- drop interaction
- keep text-only article content

**Step 2: Implement loop**

Each attempt logs structured input/output and validation result.

**Step 3: Verify**

Run backend tests.

**Step 4: Commit**

```bash
git add backend/src/nodes/bespoke
 git commit -m "feat: add bespoke repair loop"
```

---

### Task 16.4: Build bespoke failure decision UI

**Objective:** Let user choose what happens after 3 failed bespoke repair attempts.

**Files:**
- Create: `apps/editor/src/lib/components/BespokeFailureDialog.svelte`
- Create: `apps/editor/src/routes/api/workflows/[runId]/bespoke-decision/+server.ts`
- Modify: `apps/editor/src/routes/+page.svelte`

**Step 1: Implement API**

Accept decision:

- retry
- fallback
- drop
- text-only

Include expected document version.

**Step 2: Implement UI**

Show failure reason and options plainly.

**Step 3: Verify manually**

Use intentionally invalid generated code/fake provider and confirm dialog appears.

**Step 4: Commit**

```bash
git add apps/editor/src backend/src
 git commit -m "feat: add bespoke repair decision ui"
```

---

## Phase 17: Doctor Hardening

### Task 17.1: Complete `ia doctor` checks

**Objective:** Make doctor fully validate MVP operational requirements.

**Files:**
- Modify: `cli/src/doctor/checks.ts`
- Modify: `cli/src/commands/doctor.ts`
- Test: `cli/src/doctor/checks.test.ts`

**Step 1: Add real checks**

Checks:

- supported Node/package version
- SQLite database path exists and writable
- schema migrations current
- selected provider CLI/API auth works
- provider structured-output preflight passes
- local build prerequisites available
- sandbox/browser dependencies available
- export/storage dirs writable

**Step 2: Make failures actionable**

Every failure should say exactly what to fix.

**Step 3: Verify**

Run:

```bash
node cli/dist/ia.js doctor
```

Expected: complete operational report.

**Step 4: Commit**

```bash
git add cli/src
 git commit -m "feat: complete doctor diagnostics"
```

---

## Phase 18: Critic Hardening and Evaluation Fixtures

### Task 18.1: Create critic evaluation fixtures

**Objective:** Add repeatable examples for tuning candidate pruning.

**Files:**
- Create: `backend/src/nodes/evals/critic.fixtures.ts`
- Create: `backend/src/nodes/evals/criticEval.test.ts`

**Step 1: Add fixtures**

Include examples for:

- meaningful quantity interaction
- decorative animation
- useful comparison
- shallow comparison
- jargon explanation
- thematic but vague suggestion

**Step 2: Write expected outcomes**

Each fixture should include expected keep/reject and why.

**Step 3: Verify**

Run eval tests with fake provider or deterministic critic mode.

**Step 4: Commit**

```bash
git add backend/src/nodes/evals
 git commit -m "test: add critic evaluation fixtures"
```

---

### Task 18.2: Tune prompts and schemas using fixtures

**Objective:** Improve Analyst/Critic behavior once the loop is observable.

**Files:**
- Modify: `backend/src/prompts/analyst.md`
- Modify: `backend/src/prompts/critic.md`
- Modify: relevant schema files if needed

**Step 1: Run evals**

```bash
npm test -w backend -- criticEval
```

**Step 2: Tune prompts**

Make prompts enforce:

- no decorative interaction
- must answer understanding-loss question
- prefer library patterns when sufficient
- avoid generating interaction where prose alone is enough

**Step 3: Verify**

Run evals again.

**Step 4: Commit**

```bash
git add backend/src/prompts backend/src/nodes/schemas
 git commit -m "chore: harden analyst and critic prompts"
```

---

## Phase 19: Full MVP End-to-End QA

### Task 19.1: Add full happy-path integration test

**Objective:** Test full article-to-export flow with fake provider.

**Files:**
- Create: `backend/src/integration/fullReactiveValueFlow.test.ts`
- Create: `backend/src/integration/fullCompareToggleFlow.test.ts`

**Step 1: Test ReactiveValue flow**

Input article with numeric/if-then signal.

Expected:

- article persisted
- workflow runs to consent
- approval accepted
- spec generated
- library component selected
- static validation passes
- QA runs
- export files created
- manifest valid

**Step 2: Test CompareToggle flow**

Same for comparison article.

**Step 3: Verify**

Run:

```bash
npm test -w backend
npm test -w packages/bundler
npm test -w packages/components
```

**Step 4: Commit**

```bash
git add backend/src/integration
 git commit -m "test: add full mvp library flow coverage"
```

---

### Task 19.2: Add manual QA script

**Objective:** Create a repeatable local manual QA checklist.

**Files:**
- Create: `docs/manual-qa.md`

**Step 1: Write checklist**

Include:

- install
- setup
- doctor
- start
- paste article
- autosave
- analyze
- approve/reject/tweak
- data gap
- preview
- export
- open preview HTML
- inspect manifest
- cancel workflow
- edit after candidates and verify invalidation
- QA warning confirmation
- static validation hard block

**Step 2: Verify manually**

Run through checklist once before final MVP claim.

**Step 3: Commit**

```bash
git add docs/manual-qa.md
 git commit -m "docs: add manual mvp qa checklist"
```

---

## Phase 20: Final Documentation

### Task 20.1: Update README with MVP usage

**Objective:** Explain local install/start/export flow.

**Files:**
- Modify: `README.md`

**Step 1: Add sections**

- What Banderdash app is
- MVP scope
- Non-goals
- Setup
- Doctor
- Start editor
- Export artifact shape
- Security restrictions
- Development commands

**Step 2: Verify commands**

Run every command in README.

**Step 3: Commit**

```bash
git add README.md
 git commit -m "docs: document mvp usage"
```

---

## Scope Cuts to Protect MVP

Do not add these unless a separate plan is approved:

1. Hosted SaaS or accounts.
2. Remote/LAN editor mode.
3. Authentication for localhost UI.
4. Collaborative editing.
5. Iframe export.
6. WordPress/Ghost/Webflow plugins.
7. User-defined formulas/templates.
8. Runtime network calls from exported interactions.
9. Browser storage APIs inside exported interactions.
10. Visual regression/screenshot QA.
11. Prompt/provider/schema version tracking.
12. Editable project-file state as source of truth.
13. Large component library breadth before `ReactiveValue` and `CompareToggle` are proven.

---

## Recommended Spike Before Heavy Implementation

Although this plan covers the full MVP, run these as early spikes if implementation uncertainty is high:

1. **Svelte custom-element export spike**
   - Can a composed article plus Svelte interactive components compile into a self-contained custom element with unique tag name?

2. **Sandbox iframe + CSP spike**
   - Can local preview block network/external resources while still rendering generated components?

3. **Provider structured-output spike**
   - Can the chosen real provider reliably satisfy `structured(schema)` for Analyst/Critic/Spec?

4. **Static validator spike**
   - Can AST-based checks conservatively block the restricted subset violations without too many false negatives?

If a spike fails, stop and revise the implementation plan before coding downstream phases.

---

## Execution Rule

Implement one task at a time. After every task:

1. Run the exact verification command.
2. Fix failures before moving on.
3. Commit the completed task.
4. Re-read the relevant section of `interactive-article-platform-implementation.md` if the task touches product/security/workflow assumptions.

Do not skip tests for core state, workflow, validation, or export code.
