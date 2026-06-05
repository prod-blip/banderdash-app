# Engineering Context

This file is the Engineering Manager's short current-memory file for Banderdash.

It should stay concise and be updated when the real engineering state changes.

## Current State

Banderdash is in pre-implementation.

The project currently has:

- an implementation specification: `interactive-article-platform-implementation.md`;
- the beginning of a project operating system in `.banderdash-os/`;
- no product code implemented yet.

## Current Phase

Pre-implementation: governance setup and implementation planning.

## Current Engineering Priority

1. Finish the minimal Banderdash OS docs.
2. Convert the implementation specification into actionable engineering tasks.
3. Start implementation only after scope, acceptance criteria, and engineering rules are clear.

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

- Created `.banderdash-os/` as the project operating folder.
- Created `.banderdash-os/README.md`.
- Created `.banderdash-os/product-goal.md`.

## Update Rule

Update this file when:

- implementation phase changes;
- a meaningful PR is merged or closed;
- current architecture/code state changes;
- major risks change;
- next engineering priority changes.

Do not update this file for tiny copy edits, trivial refactors, or one-off notes that will not matter later.
