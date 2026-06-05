# Testing Rules

This file defines testing and verification expectations for Banderdash Developer work.

The goal is not to test everything mechanically. The goal is to protect meaningful behavior, architecture boundaries, and safety constraints.

## Default Rule

Meaningful logic needs tests or clear verification.

Small copy edits, styling-only changes, and placeholder UI may use manual verification when automated tests would add little value.

## What Must Be Tested

Prioritize automated tests for:

- article/document parsing;
- word-count behavior;
- document versioning;
- stale-action rejection;
- block-level invalidation;
- workflow stage transitions;
- provider preflight and capability checks;
- structured output validation;
- data-gap template validation;
- component prop validation;
- static validator allow/block rules;
- sandbox message validation;
- export manifest generation;
- export file naming and immutability behavior;
- cleanup behavior for old exports/temp artifacts.

## Security and Validator Tests

Security and validation rules need explicit allow/block tests.

For validators, include examples that prove dangerous behavior is blocked, such as:

- runtime network APIs;
- storage APIs;
- dynamic code execution;
- raw HTML rendering;
- host DOM access;
- disallowed imports;
- external resources;
- uncontrolled global listeners/timers.

Also include valid examples to prove the validator does not block approved safe patterns.

## Workflow Tests

For workflow behavior, prefer tests that prove state transitions and failure behavior.

Examples:

- raw text can become structured blocks;
- candidates are tied to document versions;
- edits invalidate changed blocks;
- approvals with stale versions are rejected;
- cancellation preserves valid completed results and marks incomplete work canceled;
- repair loop stops after the configured attempt limit.

## Export Tests

Export tests should verify:

- unique custom-element tag names;
- required manifest fields;
- file hashes and byte sizes are recorded;
- exports are immutable;
- no `latest` alias is created in MVP;
- old completed exports are cleaned according to retention rules.

## UI Verification

Early UI shell work may use manual verification.

Manual verification should still be written in the PR summary.

Example:

```text
Manual verification:
- ran `npm run dev`
- opened local editor page
- pasted article text
- confirmed word count updates
- confirmed over-limit article is rejected
```

As UI workflows become important, add automated coverage where practical.

## PR Requirement

Every meaningful PR must state:

```text
Tests / verification:
- <commands run>
- <manual checks performed>
- <why no automated tests were added, if applicable>
```

A PR with meaningful logic and no tests/verification should be blocked by Engineering Manager review.

## Test Quality

Prefer tests that are:

- small;
- readable;
- focused on behavior;
- stable;
- easy to run locally;
- tied to product or safety requirements.

Avoid tests that only lock implementation details unless those details are important architecture constraints.
