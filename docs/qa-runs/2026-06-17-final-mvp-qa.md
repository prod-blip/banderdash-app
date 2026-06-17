# Final MVP QA Run — 2026-06-17

## Summary

- **Result:** Conditional pass with 2 follow-up defects found.
- **Commit SHA:** `f69b881e3ba964300c62e0f2a58a10341de39961`
- **Date/time:** 2026-06-17 09:44:00 IST
- **OS / Node / npm:** macOS Darwin 25.4.0 x86_64; Node `v23.11.0`; npm `11.3.0`
- **Repo:** `/Users/apple/Desktop/Atul Work/Github/banderdash-app`
- **Scope:** tightened local audited-library MVP path from `docs/manual-qa.md`

The implemented product path works end-to-end for both audited patterns when the comparison article includes the current local-analysis trigger phrase (`versus`). The run found one QA-doc mismatch and one preview-opening limitation that should be fixed or explicitly documented before calling the MVP fully polished.

## Commands run

```bash
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

- `npm install`: passed; emitted existing Node engine warnings because current Node is `v23.11.0` while some packages prefer `^20.19 || ^22.12 || >=24` / even release lines.
- `npm test`: passed, 44 test files / 189 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed; lint placeholder reports no configured lint rules yet.
- `npm run build`: passed; SvelteKit adapter-auto reports no production adapter, expected for current local dev MVP.
- `npm audit --audit-level=critical`: exited 0; reported existing non-critical-threshold advisories: 3 low and 4 high in the SvelteKit/cookie/esbuild/Vite dependency chain.
- `node node_modules/.bin/ia setup`: passed; preserved `.banderdash/config.json`, host `127.0.0.1`, port `5173`, SQLite `.banderdash/banderdash.sqlite`, exports `.banderdash/exports`.
- `node node_modules/.bin/ia doctor`: passed with provider warning only; result `ready for current MVP slice`.
- Static validation hard-block targeted tests: passed, 3 test files / 26 tests.
- Localhost binding check: `node` listening only on `127.0.0.1:5173`.

## Browser QA results

### Editor startup

- Started with `node node_modules/.bin/ia start`.
- Opened `http://127.0.0.1:5173/`.
- Page title: `Banderdash Local Editor`.
- UI loaded input, review, export, debug/history, and preview sections.
- Browser console showed no JavaScript errors during the checked flows.

### ReactiveValue flow

Article used:

```text
# Pricing sensitivity

If monthly usage doubles from 10 to 20 projects, the support load doubles too. This matters because a small customer base can become a support-heavy queue when each project creates onboarding work.
```

Steps and results:

- Pasted article; word count updated.
- Saved draft; article persisted as `article_ccfb89eb-bfac-4897-a614-9e05a21bb500`.
- Edited article and updated draft; version advanced to `v2` and persisted block list updated.
- Analyzed article; one `ReactiveValue` candidate survived critic review.
- Candidate included rationale, understanding-loss text, and source block id.
- Approved candidate; approval buttons disabled and export became available.
- Exported once, then re-exported; second export created a new immutable directory instead of overwriting the first.
- Loaded debug/history; version `v2` showed `2 QA` and `2 exports` records.
- QA records were `passed` with empty findings.

ReactiveValue export inspected:

```text
.banderdash/exports/export_d552e227-232e-4510-ac99-084d105f482c
```

Files:

- `ia-article-85bf85210b79.js` — 1728 bytes, SHA prefix `31b7509747ac`
- `preview.html` — 349 bytes, SHA prefix `725b79b74d09`
- `manifest.json` — 845 bytes, SHA prefix `b28f26dbdda8`

Manifest check:

- tag: `ia-article-85bf85210b79`
- article: `article_ccfb89eb-bfac-4897-a614-9e05a21bb500`
- document version: `2`
- interaction: `ReactiveValue`, mode `library`
- no obvious external markers found in generated JS/HTML (`http://`, `https://`, `cdn`, `fetch(`, storage APIs, cookie access, `eval(`).

### Edit-after-candidates invalidation

- Replaced the ReactiveValue article with a comparison article while previous approval/export records existed.
- Before saving, UI showed `unsaved changes`, disabled analysis/debug actions, and disabled export.
- After updating the draft, version advanced to `v3`; candidate/export state reset and approved count returned to `0`.
- This satisfied the stale generated-state non-reuse expectation.

### CompareToggle flow

The checklist article as written did **not** trigger the local `compare_toggle` path. See defect QA-001 below.

Corrected article used to verify the implemented CompareToggle product path:

```text
# Publishing tradeoffs

Local-first exports versus hosted embeds: local-first preserves writer and reader control, while hosted embeds optimize distribution reach. The tradeoff is not cosmetic because it changes who can keep reading if the service disappears.
```

Steps and results:

- Updated draft to version `v4`.
- Analyzed article; one `compare_toggle` candidate survived critic review.
- Candidate included rationale, understanding-loss text, and source block id.
- Approved candidate; approval buttons disabled and export became available.
- Exported approved candidate; UI showed custom element and 3 export files.
- Loaded debug/history; version `v4` showed `1 QA` and `1 exports`.
- Browser console showed no JavaScript errors.

CompareToggle export inspected:

```text
.banderdash/exports/export_87506f51-55d5-46f0-9daa-2605a55973de
```

Files:

- `ia-article-753f4f2ba7b5.js` — 1719 bytes, SHA prefix `23552f19a690`
- `preview.html` — 350 bytes, SHA prefix `1b4d4eaae567`
- `manifest.json` — 845 bytes, SHA prefix `c88cc98145dd`

Manifest check:

- tag: `ia-article-753f4f2ba7b5`
- article: `article_ccfb89eb-bfac-4897-a614-9e05a21bb500`
- document version: `4`
- interaction: `CompareToggle`, mode `library`
- no obvious external markers found in generated JS/HTML (`http://`, `https://`, `cdn`, `fetch(`, storage APIs, cookie access, `eval(`).

Preview check:

- Opening the exported `preview.html` through a local HTTP server rendered the article and interaction fallback successfully at `http://127.0.0.1:8181/preview.html`.
- Opening the same file through `file://.../preview.html` left the body visually empty in the browser tool because the custom element module was not defined. See defect QA-002 below.

### Cancellation check

- No non-terminal workflow runs were visible during this manual run.
- Cancellation UI was therefore not exercised manually.
- Existing automated cancellation coverage remains part of the passing `npm test` run.

### Static validation hard-block check

- Export UI exposed only the QA warning/crash confirmation checkbox.
- No static-validation override affordance was visible.
- Targeted static-validator/export tests passed: 3 files / 26 tests.

## Defects found

GitHub tracking issues:

- QA-001: https://github.com/prod-blip/banderdash-app/issues/46
- QA-002: https://github.com/prod-blip/banderdash-app/issues/47

### QA-001 — Manual QA CompareToggle article does not trigger local compare analysis

- **Severity:** Low
- **Category:** QA documentation / content
- **Observed:** The checklist article in `docs/manual-qa.md` says:

  ```text
  Local-first exports preserve writer and reader control, while hosted embeds optimize distribution reach. The tradeoff is not cosmetic: it changes who can keep reading if the service disappears.
  ```

  The editor returned: `No numeric interaction candidates survived local analysis for this draft.`

- **Expected:** The documented CompareToggle manual QA article should produce a `compare_toggle` candidate.
- **Actual product behavior:** The local editor heuristic currently requires explicit comparison language such as `versus`, `vs`, `compared with`, `compared to`, or `rather than`.
- **Suggested fix:** Update `docs/manual-qa.md` CompareToggle article to include `versus`, or broaden the local-analysis heuristic to treat this documented phrasing as comparison language.

### QA-002 — Exported preview works over localhost HTTP but not when opened as a direct file URL in browser QA

- **Severity:** Medium
- **Category:** Export preview / UX
- **Observed:** Opening:

  ```text
  file:///Users/apple/Desktop/Atul%20Work/Github/banderdash-app/.banderdash/exports/export_87506f51-55d5-46f0-9daa-2605a55973de/preview.html
  ```

  produced an empty page in the browser tool. Runtime inspection showed `customElements.get('ia-article-753f4f2ba7b5') === undefined`.

- **Expected:** The preview path shown in the editor should be directly useful for local artifact inspection, or README/manual QA should state that exported previews must be served over localhost HTTP.
- **Actual:** Serving the export directory with `python3 -m http.server 8181 --bind 127.0.0.1` rendered `preview.html` successfully at `http://127.0.0.1:8181/preview.html` with no console errors.
- **Suggested fix:** Either make generated `preview.html` file-openable without module-loading issues, or expose/document a local preview server command/URL.

## Overall readiness call

The tightened MVP implementation is functionally end-to-end for the audited-library path:

- local setup/doctor/start passes;
- editor draft save/update works;
- stale/unsaved state blocks later actions;
- `ReactiveValue` and `CompareToggle` work when using article text that matches current local heuristics;
- writer approval gates export;
- immutable export artifact generation works;
- debug/history surfaces QA/export records;
- static validation remains hard-blocked by tests and UI affordances.

Before a public/demo-ready MVP claim, fix or explicitly accept QA-001 and QA-002.
