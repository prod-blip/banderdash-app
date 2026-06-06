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
- a real `ia doctor` check framework for local diagnostics/preflight;
- a localhost-only SvelteKit editor shell with placeholder workflow panels.

The product workflow, SQLite state store, provider abstraction, component library, validators, sandbox QA, and export pipeline are not implemented yet.

## Current Phase

Implementation foundation: repository scaffold, CLI shell, setup configuration, diagnostics, and editor shell.

## Current Engineering Priority

1. Start real SQLite state setup.
2. Add shared ArticleDoc types and parsing after SQLite service foundation.
3. Extend doctor with SQLite checks once the database subsystem exists.

## MVP Plan Progress

`implementation-plan.md` currently lists 42 implementation tasks. Tasks 0.1, 0.2, 1.1, 1.2, 1.3, and 1.4 are landed on `main`, leaving 36 plan tasks. Do not treat that as 36 required PRs; the expected remaining reviewable PR count is roughly 21–26 if closely related small tasks are grouped carefully.

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

## Update Rule

Update this file when:

- implementation phase changes;
- a meaningful PR is merged or closed;
- current architecture/code state changes;
- major risks change;
- next engineering priority changes.

Do not update this file for tiny copy edits, trivial refactors, or one-off notes that will not matter later.
