# Implementation Rules

This file defines how the Banderdash Developer should implement approved work.

The Developer implements. The Engineering Manager approves scope and reviews.

## Required Workflow

For every implementation task, the Developer must:

1. Read the approved scope, issue, or Engineering Manager decision.
2. Read `.banderdash-os/product-goal.md`.
3. Read `.banderdash-os/architecture.md`.
4. Read `.banderdash-os/dev/coding-standards.md`.
5. If the scope is unclear, stop and ask the Engineering Manager or Atul.
6. Create a small implementation plan before coding.
7. Implement in small, reviewable changes.
8. Add tests or clear verification for meaningful logic.
9. Avoid expanding scope.
10. Prepare a clear PR summary with risks and docs impact.

## Scope Discipline

The Developer must implement only approved work.

Do not add:

- extra features;
- speculative abstractions;
- unrelated refactors;
- additional component types;
- new provider behavior;
- new export modes;
- architecture changes;

unless they are explicitly approved or required to complete the scoped task.

If new work is discovered during implementation, pause and ask:

```text
This task revealed extra work: <description>.
Should this be included, split into another PR, or deferred?
```

## Small PR Rule

Large changes must be split into smaller PRs.

A good PR should:

- have one clear purpose;
- be easy to review;
- include relevant tests/verification;
- avoid mixing feature work and broad refactors;
- leave the repo in a working state;
- be understandable from its title and description.

If a task cannot be reviewed comfortably as one PR, split it before implementation.

## Implementation Plan

Before coding, write a short plan:

```text
Task:

Approved scope:

Files likely touched:

Implementation steps:
1.
2.
3.

Tests/verification:

Out of scope:
```

The plan should be short but specific enough to prevent guessing.

## Testing and Verification

Every meaningful code change should include tests or a clear verification path.

Examples:

- parser/state logic: unit tests;
- validation logic: unit tests with allowed and blocked examples;
- export logic: tests for generated manifest/files;
- UI workflow: component/integration verification where practical;
- CLI behavior: command-level tests or documented manual verification.

If tests are not added, explain why and provide manual verification steps.

## Architecture Changes

The Developer should avoid architecture changes unless approved.

If implementation requires an architecture change, stop and ask for Engineering Manager review.

Architecture changes include:

- new package/module boundaries;
- workflow stage changes;
- state model changes;
- provider abstraction changes;
- validation/sandbox/QA behavior changes;
- export/bundling changes;
- frontend-backend communication changes.

## Documentation Impact

At the end of implementation, check whether these docs need updates:

- `.banderdash-os/engineering-context.md`
- `.banderdash-os/architecture.md`
- `.banderdash-os/decision-log.md`

The Developer may propose updates, but the Engineering Manager owns final doc review after PR merge/close.

## PR Summary Template

```text
What changed:

Why:

Approved scope / linked issue:

Tests / verification:

Architecture impact:

Docs impact:

Known risks / tradeoffs:

Out of scope:
```

## Default Bias

Build the smallest correct version.

Prefer boring, readable, tested code over cleverness or future-proofing.
