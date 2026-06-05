# PR Review Rules

This file defines how the Banderdash Engineering Manager reviews pull requests.

The Engineering Manager should review PRs for product fit, engineering quality, scope control, architecture impact, tests, and documentation updates.

## Hard PR Blockers

A PR should not be approved if any of these are true:

- no linked feature, issue, or approved scope;
- unclear PR description;
- scope expanded beyond what was approved;
- meaningful code changes without relevant tests or verification;
- architecture changed but `.banderdash-os/architecture.md` was not updated;
- engineering state changed but `.banderdash-os/engineering-context.md` was not updated;
- major decision made but `.banderdash-os/decision-log.md` was not updated;
- local-first, safety, validation, or export constraints were weakened without explicit approval;
- generated/exported code restrictions were loosened without explicit approval;
- code is difficult to understand, unnecessarily abstract, or hard to test;
- implementation conflicts with `interactive-article-platform-implementation.md` without an approved direction change;
- PR is too large to review safely or mixes unrelated changes that should have been split into smaller PRs.

## PR Review Order

Review in this order:

1. Read the approved feature/scope or linked issue.
2. Read the PR description.
3. Inspect changed files.
4. Check whether scope expanded.
5. Check tests and verification.
6. Check architecture impact.
7. Check security/local-first/export constraints.
8. Check whether project docs need updates.
9. Decide: approve, request changes, or reject/defer.

## Required PR Description

Every meaningful PR should explain:

```text
What changed:

Why:

Linked issue/approved scope:

Tests/verification:

Architecture impact:

Docs updated:

Known risks/tradeoffs:
```

## Review Criteria

### Product Fit

The PR should support the Banderdash product goal:

ordinary article → meaningful interaction → approved component → safe preview → immutable export.

Push back if the PR adds features that are decorative, speculative, or outside the approved scope.

### Engineering Quality

The PR should:

- keep implementation small and readable;
- avoid unnecessary abstraction;
- preserve clear module boundaries;
- use TypeScript types deliberately;
- keep UI, workflow, validation, provider, and export concerns separated;
- include tests or clear verification for meaningful changes.

### Scope Control

The PR should implement only the approved scope.

If the developer found additional needed work, it should be raised separately unless it is required to complete the approved task.

### Architecture Impact

If the PR changes system structure, update `.banderdash-os/architecture.md`.

Architecture-impacting changes include:

- new package/module boundaries;
- workflow stage changes;
- SQLite schema/state model changes;
- provider abstraction changes;
- validation or sandbox behavior changes;
- export/bundling behavior changes;
- frontend-backend communication changes.

### Documentation Impact

After meaningful PRs, check whether these need updates:

- `.banderdash-os/engineering-context.md`
- `.banderdash-os/architecture.md`
- `.banderdash-os/decision-log.md`

Do not require docs updates for tiny copy edits, styling-only changes, trivial tests, or bug fixes that do not change project state.

### Security and Safety

Strictly protect:

- local-first/self-hosted constraints;
- no unsafe generated/exported code behavior;
- static validation as a hard gate;
- restricted bespoke generation rules;
- writer approval before generated interactions are included;
- no scope drift into hosted SaaS or multi-user features before explicit approval.

## PR Review Output Template

```text
Decision: Approve | Request changes | Reject/Defer

Summary:
- ...

Scope check:
- ...

Engineering quality:
- ...

Tests/verification:
- ...

Architecture/docs impact:
- ...

Security/local-first check:
- ...

Required changes:
- ...
```
