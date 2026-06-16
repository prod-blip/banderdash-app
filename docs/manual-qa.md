# Banderdash MVP Manual QA Checklist

Use this checklist before claiming the tightened local-first MVP is ready. It is intentionally repeatable and local-only: run it from a clean checkout on the machine that will run the editor.

## Scope

This checklist covers the current audited-library MVP path:

```text
install -> setup -> doctor -> start editor -> paste article -> save draft -> analyze -> approve/reject -> export -> inspect files/debug history
```

It does **not** certify deferred scope: hosted SaaS, LAN access, auth, collaboration, additional component patterns, browser-backed visual QA, or restricted bespoke generation.

## Preconditions

- Node.js 22+ is available.
- The repo is checked out locally.
- Commands run from the repo root.
- No secrets are committed to the repo.
- The editor remains bound to `127.0.0.1` only.

## Test articles

Use short articles that intentionally trigger the two audited MVP patterns.

### ReactiveValue article

```text
# Pricing sensitivity

If monthly usage doubles from 10 to 20 projects, the support load doubles too. This matters because a small customer base can become a support-heavy queue when each project creates onboarding work.
```

### CompareToggle article

```text
# Publishing tradeoffs

Local-first exports preserve writer and reader control, while hosted embeds optimize distribution reach. The tradeoff is not cosmetic: it changes who can keep reading if the service disappears.
```

## 1. Install and baseline checks

- [ ] Run `npm install`.
- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm audit --audit-level=critical`.

Expected:

- Install succeeds.
- Tests/typecheck/lint/build pass.
- Audit exits successfully at the critical threshold. Existing lower-than-critical SvelteKit/cookie/esbuild/Vite advisories may still be reported; record them but do not treat them as an MVP blocker unless a critical advisory appears.

## 2. Setup and doctor

- [ ] Run `node node_modules/.bin/ia setup`.
- [ ] Confirm `.banderdash/config.json` is created or preserved.
- [ ] Confirm the setup output shows `host: 127.0.0.1`.
- [ ] Run `node node_modules/.bin/ia doctor`.

Expected:

- Setup does not ask for secrets.
- Config uses local SQLite and export paths under `.banderdash/`.
- Doctor passes required checks or clearly reports only provider-related warnings when no real provider is configured.
- Doctor must fail if host binding is changed away from `127.0.0.1`.

## 3. Start the local editor

- [ ] Run `node node_modules/.bin/ia start`.
- [ ] Open the printed local URL in a browser.
- [ ] Confirm the URL is `127.0.0.1` / localhost only.
- [ ] Confirm the page title is Banderdash and the editor loads.

Expected:

- No LAN URL is advertised.
- The editor shows article input, touch-point review, export, debug/history, and preview sections.
- Preview may still be a placeholder in this tightened MVP; export file inspection is the current artifact verification path.

## 4. Paste and save an article

Run this section once with the ReactiveValue article and once with the CompareToggle article.

- [ ] Paste the article into the Article prose textarea.
- [ ] Confirm the word count updates.
- [ ] Click **Save draft**.
- [ ] Confirm the UI shows a saved local draft id and version.
- [ ] Confirm persisted blocks are shown.
- [ ] Edit the draft text.
- [ ] Confirm the UI shows unsaved changes.
- [ ] Click **Update draft**.
- [ ] Confirm the version increments.

Expected:

- Articles under the 5,000-word MVP limit save successfully.
- Saved block text matches the pasted article.
- Updating a saved draft resets candidate/export state until analysis is rerun.

## 5. Analyze and review touch-points

Run this section once with the ReactiveValue article and once with the CompareToggle article.

- [ ] With no unsaved changes, click **Analyze article**.
- [ ] Confirm the Touch-point review panel returns at least one candidate for the chosen test article.
- [ ] Confirm the candidate includes:
  - [ ] a pattern (`ReactiveValue` or `compare_toggle`),
  - [ ] a rationale,
  - [ ] understanding-loss text,
  - [ ] a source block id.
- [ ] Approve one candidate.
- [ ] If more than one candidate appears, reject at least one nonessential candidate.

Expected:

- `ReactiveValue` article produces a numeric relationship candidate.
- `CompareToggle` article produces a comparison candidate.
- Approval/rejection buttons disable after a decision.
- Export stays disabled until at least one current-version candidate is approved.

## 6. Export approved artifact

- [ ] Leave **Confirm export if sandbox QA returns warnings or crashes** unchecked for the first export attempt.
- [ ] Click **Export article**.
- [ ] If export is blocked by QA warnings/crashes, read the message, then check the QA confirmation box and retry.
- [ ] Confirm the export result shows:
  - [ ] preview path,
  - [ ] custom element tag,
  - [ ] `manifest.json`,
  - [ ] `preview.html`,
  - [ ] custom-element `.js` file,
  - [ ] byte sizes and SHA-256 prefixes.

Expected:

- Static validation failures cannot be overridden.
- QA warnings/crashes require explicit confirmation before export.
- Export artifacts are written under the configured local exports directory.
- Export output does not use external CDN/runtime resources.

## 7. Inspect generated files

- [ ] Open the preview path shown in the export result.
- [ ] Open the export directory in the filesystem.
- [ ] Inspect `manifest.json`.
- [ ] Confirm the manifest contains:
  - [ ] export id,
  - [ ] article id/version,
  - [ ] custom element tag,
  - [ ] interaction entries,
  - [ ] file hashes/byte metadata.
- [ ] Confirm exactly one immutable export directory was created for this export.
- [ ] Re-export the same article and confirm a new export directory is created instead of overwriting the prior one.

Expected:

- Preview HTML opens locally.
- Manifest paths match files on disk.
- Re-export creates a new immutable artifact path.

## 8. Debug/history verification

- [ ] Click **Load debug history**.
- [ ] Confirm the summary shows workflow/debug records for the current article version.
- [ ] Open Workflow runs.
- [ ] Confirm stage statuses/events are visible.
- [ ] Open Structured LLM logs.
- [ ] Confirm logs contain structured input/output only, not raw provider request/response dumps.
- [ ] Open QA warnings.
- [ ] Confirm QA records are visible after export.
- [ ] Open Exports.
- [ ] Confirm the latest export record matches the file paths shown in the Export panel.

Expected:

- Debug/history data is local and version-scoped.
- The panel does not expose secrets or raw provider payload dumps.

## 9. Edit-after-candidates invalidation

- [ ] Save an article.
- [ ] Analyze it.
- [ ] Approve one candidate.
- [ ] Edit the source paragraph for that candidate.
- [ ] Click **Update draft**.
- [ ] Confirm the article version increments.
- [ ] Confirm export is no longer available for the previous approval until analysis/approval is rerun.
- [ ] Load debug history for the new version.

Expected:

- Changed source blocks invalidate stale generated state.
- Stale approvals/export results are not silently reused for the new version.

## 10. Cancellation check

The current editor exposes cancellation from Debug/history for non-terminal workflow runs. If a non-terminal run is visible:

- [ ] Click **Cancel workflow run**.
- [ ] Confirm the panel reports cancellation requested.
- [ ] Reload debug history.
- [ ] Confirm cancellation events are persisted.

Expected:

- Pending/running/waiting runs can record cancellation.
- Completed exports remain intact.

## 11. Static validation hard-block check

This is primarily covered by automated tests in the current MVP. During manual QA:

- [ ] Confirm the Export section never offers a way to override static validation failures.
- [ ] Confirm the only override affordance is for Sandbox QA warnings/crashes.
- [ ] Run `npm test -- packages/validators/src/restrictedSubset.test.ts backend/src/nodes/staticValidator.test.ts backend/src/nodes/exportNode.test.ts` if a manual validation concern appears.

Expected:

- Unsafe generated/exported code paths remain hard-blocked.
- QA warning confirmation does not weaken static validation.

## 12. Record results

For each manual QA run, record:

```text
Date:
Commit SHA:
OS / Node version:
Commands run:
Article used: ReactiveValue / CompareToggle / other
Export directory:
Pass/fail:
Failures/blockers:
Notes:
```

## Current known limitations to note, not fail

- Preview panel in the editor may still be a placeholder; inspect generated `preview.html` and manifest for the current MVP export artifact check.
- Autosave and data-gap UI are not complete; use explicit Save/Update and approval controls.
- Provider selection beyond the deterministic local/fake path and OpenAI-compatible adapter remains limited.
- Browser-backed visual QA is not implemented; current Sandbox QA is non-visual and persisted through backend records.
