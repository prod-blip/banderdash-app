# Feature Gate

This file defines how the Banderdash Engineering Manager evaluates feature ideas before implementation.

Every feature must pass through this gate before Developer work begins.

## Required Feature Review Output

Every Engineering Manager feature review must end with exactly one decision:

- `Approve`
- `Approve with smaller scope`
- `Defer`
- `Reject`
- `Needs clarification`

## Review Questions

For every proposed feature, the Engineering Manager should ask:

1. Does this help Banderdash move from ordinary article to meaningful interaction to exportable artifact?
2. Does this improve writer control, article quality, reliability, or engineering quality?
3. Is it required for the current MVP, or can it wait?
4. Does it add product or architecture complexity?
5. Does it weaken local-first, safety, validation, or export constraints?
6. Is the feature specific enough to implement without guessing?
7. Can the feature be built in a smaller version first?

## Approve

Use `Approve` when:

- the feature clearly supports the current product goal;
- the scope is specific;
- the engineering path is reasonable;
- risks are understood;
- acceptance criteria can be written clearly.

The Engineering Manager must also provide:

- smallest buildable scope;
- acceptance criteria;
- expected files/areas affected;
- required tests or verification;
- docs likely to update.

## Approve with Smaller Scope

Use `Approve with smaller scope` when the idea is directionally good but too broad.

The Engineering Manager must define the smaller version and explicitly say what is excluded.

Example:

- Instead of “support many interaction components,” approve only one audited component end-to-end.
- Instead of “complete provider system,” approve one provider adapter plus fake provider tests.

## Defer

Use `Defer` when:

- the feature may be useful later;
- it is not needed for the current MVP step;
- it adds complexity before the core loop works;
- it depends on unfinished foundations.

Deferred features should be recorded only if they are important enough to revisit.

## Reject

Use `Reject` when:

- the feature conflicts with the product goal;
- the feature is mostly decorative or gimmicky;
- it weakens safety/security constraints;
- it adds major complexity without clear user value;
- it conflicts with the implementation specification and no explicit direction change has been approved.

## Needs Clarification

Use `Needs clarification` when the Engineering Manager cannot make a responsible decision without more information.

Ask focused questions. Do not proceed on assumptions.

Good clarification questions:

- Who is the user for this feature?
- What problem does it solve?
- What is the smallest useful version?
- Is this required for MVP or post-MVP?
- What existing workflow does this change?

## Pushback Bias

The Engineering Manager should push back by default on:

- vague feature requests;
- broad platform ideas before the MVP loop works;
- adding many component types too early;
- SaaS/multi-user/collaboration features before MVP;
- changes that reduce writer control;
- changes that make generated/exported code less safe;
- architecture abstractions without immediate need;
- feature ideas that are too large to review or implement safely in one PR.

## Large Feature Rule

If a feature is too large, the Engineering Manager must not approve it as one implementation task.

Instead, the Engineering Manager should split it into smaller PR-sized slices with clear acceptance criteria for each slice.

Each slice should be independently reviewable and should move the project forward without requiring the entire feature to be finished at once.

## Feature Review Template

```text
Feature: <name>

Decision: Approve | Approve with smaller scope | Defer | Reject | Needs clarification

Reason:
- ...

Smallest buildable version:
- ...

Excluded from scope:
- ...

Engineering impact:
- ...

Risks:
- ...

Acceptance criteria:
- ...

Docs/issues to update:
- ...
```
