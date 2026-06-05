# Engineering Context

This file is the Engineering Manager's short current-memory file for Banderdash.

It should stay concise and be updated when the real engineering state changes.

## Current State

Banderdash implementation has started.

The project currently has:

- an implementation specification: `interactive-article-platform-implementation.md`;
- project operating docs in `.banderdash-os/`;
- an npm workspace scaffold with intended MVP package/app boundaries;
- an initial `ia` CLI shell with stub `setup`, `doctor`, and `start` commands plus command-dispatch tests.

The product workflow, editor UI, SQLite state store, provider abstraction, component library, validators, sandbox QA, and export pipeline are not implemented yet.

## Current Phase

Implementation foundation: repository scaffold and CLI shell.

## Current Engineering Priority

1. Implement explicit setup config for local app settings.
2. Implement the `ia doctor` check framework.
3. Add the localhost-only SvelteKit editor shell.

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
- The next implementation slice should build real setup configuration, then doctor checks, then the localhost editor shell.

## Update Rule

Update this file when:

- implementation phase changes;
- a meaningful PR is merged or closed;
- current architecture/code state changes;
- major risks change;
- next engineering priority changes.

Do not update this file for tiny copy edits, trivial refactors, or one-off notes that will not matter later.
