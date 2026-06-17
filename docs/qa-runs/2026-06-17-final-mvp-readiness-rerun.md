# Final MVP Readiness QA Rerun — 2026-06-17

## Summary

- **Result:** Pass.
- **Commit SHA:** `fd9986414042ad51a748d60a876b3c1c0841554b`
- **Date/time:** 2026-06-17 11:45:24 IST
- **OS / Node / npm:** macOS Darwin 25.4.0 x86_64; Node `v23.11.0`; npm `11.3.0`
- **Repo:** `/Users/apple/Desktop/Atul Work/Github/banderdash-app`
- **Scope:** tightened local audited-library MVP path from `docs/manual-qa.md`, rerun after PR #49 fixed the previous final-QA follow-ups.

The current `main` build passes the tightened local MVP readiness check. The audited-library path works end-to-end for both `ReactiveValue` and `CompareToggle`, including the documented CompareToggle QA article and direct `file://` preview rendering.

Previous final-QA follow-up issues are closed:

- QA-001 / issue #46: `CLOSED` — https://github.com/prod-blip/banderdash-app/issues/46
- QA-002 / issue #47: `CLOSED` — https://github.com/prod-blip/banderdash-app/issues/47
- Fix PR: #49 `MERGED` — https://github.com/prod-blip/banderdash-app/pull/49

## Commands run

```bash
git rev-parse HEAD
git status --short --branch
date '+%Y-%m-%d %H:%M:%S %Z'
uname -a
node --version
npm --version
npm install
npm test
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=critical
node node_modules/.bin/ia setup
node node_modules/.bin/ia doctor
npm test -- packages/validators/src/restrictedSubset.test.ts backend/src/nodes/staticValidator.test.ts backend/src/nodes/exportNode.test.ts
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

## Command results

- `npm install`: passed; emitted existing Node engine warnings because current Node is `v23.11.0` while some packages prefer even release lines / `^20.19 || ^22.12 || >=24`.
- `npm test`: passed, 45 test files / 192 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed; lint placeholder reports no configured lint rules yet.
- `npm run build`: passed; SvelteKit adapter-auto reports no production adapter, expected for current local dev MVP.
- `npm audit --audit-level=critical`: exited 0; reported existing non-critical-threshold advisories: 3 low and 4 high in the SvelteKit/cookie/esbuild/Vite dependency chain.
- `node node_modules/.bin/ia setup`: passed; preserved `.banderdash/config.json`, host `127.0.0.1`, port `5173`, SQLite `.banderdash/banderdash.sqlite`, exports `.banderdash/exports`.
- `node node_modules/.bin/ia doctor`: passed with provider warning only; result `ready for current MVP slice`.
- Static validation hard-block targeted tests: passed, 3 test files / 26 tests.
- Localhost binding check: existing editor process `node` listened only on `127.0.0.1:5173`.

## Browser QA results

### Editor startup

- Opened `http://127.0.0.1:5173/`.
- Page title: `Banderdash Local Editor`.
- UI loaded input, review, export, debug/history, and preview sections.
- Browser console showed no JavaScript errors during checked flows.
- Attempting to start a second editor instance failed because port `5173` was already in use by an existing localhost-only editor process; `lsof` confirmed the active listener was `127.0.0.1:5173`.

### ReactiveValue flow

Article used:

```text
# Pricing sensitivity

If monthly usage doubles from 10 to 20 projects, the support load doubles too. This matters because a small customer base can become a support-heavy queue when each project creates onboarding work.
```

Steps and results:

- Pasted article; word count updated.
- Saved draft; article persisted as `article_6af4e082-606c-4db6-afc9-94030f823cf7`.
- Edited article and updated draft; version advanced to `v2` and persisted block list updated.
- Analyzed article; one `ReactiveValue` candidate survived critic review.
- Candidate included rationale, understanding-loss text, and source block id.
- Approved candidate; approval buttons disabled and export became available.
- Exported once, then re-exported; second export created a new immutable directory instead of overwriting the first.
- Loaded debug/history; version `v2` showed `2 QA` and `2 exports` records.

ReactiveValue exports inspected:

```text
.banderdash/exports/export_236bd78f-e3c6-4110-85df-8fc6ec8f2a7c
.banderdash/exports/export_97eaaed9-2437-495e-a3b8-6d74b31e4fec
```

Latest ReactiveValue export details:

- tag: `ia-article-b748414f92c2`
- article: `article_6af4e082-606c-4db6-afc9-94030f823cf7`
- document version: `2`
- interaction: `ReactiveValue`, mode `library`
- files:
  - `ia-article-b748414f92c2.js` — 1752 bytes, SHA prefix `2eb426c18fb3`
  - `preview.html` — 2110 bytes, SHA prefix `e5b42b7794d8`
  - `manifest.json` — 846 bytes, SHA prefix `f24727b51f80`
- manifest-listed hashes matched the generated JS and preview files.
- no obvious external/forbidden markers found in generated files: `http://`, `https://`, `cdn`, `fetch(`, storage APIs, cookie access, `eval(`.
- direct `file://` preview rendered successfully; `customElements.get('ia-article-b748414f92c2')` returned a defined custom element and shadow content included article/fallback text.

### Edit-after-candidates invalidation

- Replaced the ReactiveValue article with the documented CompareToggle article while previous approval/export records existed.
- Before saving, UI showed `unsaved changes`, disabled analysis/debug actions, and disabled export.
- After updating the draft, version advanced to `v3`; candidate/export state reset and approved count returned to `0`.
- This satisfied the stale generated-state non-reuse expectation.

### CompareToggle flow

Documented checklist article used:

```text
# Publishing tradeoffs

Local-first exports preserve writer and reader control, while hosted embeds optimize distribution reach. The tradeoff is not cosmetic: it changes who can keep reading if the service disappears.
```

Steps and results:

- Updated draft to version `v3`.
- Analyzed article; one `compare_toggle` candidate survived critic review.
- Candidate included rationale, understanding-loss text, and source block id.
- Approved candidate; approval buttons disabled and export became available.
- Exported approved candidate; UI showed custom element and 3 export files.
- Loaded debug/history; version `v3` showed `1 QA` and `1 exports`.
- Browser console showed no JavaScript errors.

CompareToggle export inspected:

```text
.banderdash/exports/export_d2eea8d9-0111-4a1e-8a39-ad7dc2261cf0
```

Files:

- `ia-article-914cd920b944.js` — 1677 bytes, SHA prefix `cc27fc19f83f`
- `preview.html` — 2036 bytes, SHA prefix `f5f0905a99c3`
- `manifest.json` — 846 bytes, SHA prefix `f8b920eeca6c`

Manifest check:

- tag: `ia-article-914cd920b944`
- article: `article_6af4e082-606c-4db6-afc9-94030f823cf7`
- document version: `3`
- interaction: `CompareToggle`, mode `library`
- manifest-listed hashes matched the generated JS and preview files.
- no obvious external/forbidden markers found in generated files: `http://`, `https://`, `cdn`, `fetch(`, storage APIs, cookie access, `eval(`.

Preview check:

- Opening the exported `preview.html` directly through `file://` rendered the article and fallback content.
- `customElements.get('ia-article-914cd920b944')` returned a defined custom element.
- Browser console showed no JavaScript errors.

### Cancellation check

- No non-terminal workflow runs were visible during this manual run.
- Cancellation UI was therefore not exercised manually.
- Existing automated cancellation coverage remains part of the passing `npm test` run.

### Static validation hard-block check

- Export UI exposed only the QA warning/crash confirmation checkbox.
- No static-validation override affordance was visible.
- Targeted static-validator/export tests passed: 3 files / 26 tests.

## Defects found

None in this rerun.

## Overall readiness call

The tightened MVP implementation is ready for the local audited-library scope:

- local setup/doctor/start passes;
- editor draft save/update works;
- stale/unsaved state blocks later actions;
- `ReactiveValue` and the documented `CompareToggle` article both produce approved/exportable candidates;
- writer approval gates export;
- immutable export artifact generation works;
- debug/history surfaces QA/export records;
- direct `file://` preview rendering works after PR #49;
- static validation remains hard-blocked by tests and UI affordances.

This pass does not certify deferred scope: restricted bespoke generation, browser-backed visual QA, additional component patterns, additional provider adapters, hosted/SaaS mode, auth, collaboration, or LAN access.
