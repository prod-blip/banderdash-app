# Coding Standards

This file defines how the Banderdash Developer should write code.

## Defaults

- Use TypeScript first.
- Prefer strict types over loose objects or `any`.
- Keep files and modules small.
- Prefer readable code over clever code.
- Avoid unnecessary abstractions.
- Follow SvelteKit and Svelte conventions.
- Write tests for meaningful logic.
- Prefer Zod for schemas and runtime validation when data crosses boundaries.
- Treat security, local-first behavior, validation, and export safety as core requirements.

## TypeScript

Use clear types for:

- article/document models;
- workflow states;
- provider inputs/outputs;
- component props;
- validation results;
- export manifests;
- SQLite records where practical.

Avoid:

- broad `any` usage;
- untyped LLM outputs;
- unvalidated external/provider data;
- deeply nested types that make implementation hard to follow.

## Module Style

Prefer modules that do one thing well.

Good modules have:

- clear inputs;
- clear outputs;
- limited side effects;
- tests for important behavior;
- names that explain their responsibility.

Avoid combining unrelated concerns in one file, such as UI rendering, database writes, provider calls, and validation logic together.

## Svelte / SvelteKit

For editor UI:

- keep components focused;
- move non-UI logic out of Svelte components;
- keep server-side workflow/database logic outside UI components;
- use clear props and events;
- avoid clever reactive logic that is hard to debug.

## Validation

Use validation at boundaries:

- provider/LLM structured outputs;
- user input that affects generated interactions;
- component props;
- export manifest data;
- sandbox messages;
- API/server action payloads.

Prefer Zod when schemas are reused across runtime validation and TypeScript inference.

Simple internal helper validators are acceptable for very small local-only checks.

## Testing

Meaningful logic should have tests.

Prioritize tests for:

- document parsing/versioning;
- block invalidation;
- workflow transitions;
- provider preflight behavior;
- static validation;
- component prop validation;
- export manifest generation;
- security restrictions.

UI-only polish does not need heavy tests unless it affects workflow correctness.

## PR Size

Keep PRs small and reviewable.

If a change is large, split it into multiple PRs.

Each PR should:

- have one clear purpose;
- be independently reviewable;
- include relevant tests/verification;
- avoid mixing unrelated refactors with feature work;
- leave the repo in a working state.

The Developer must not expand a task into a large multi-feature PR without Engineering Manager approval.

## Security and Local-First Constraints

Do not weaken these without explicit approval:

- local/self-hosted assumptions;
- no unsafe generated/exported code behavior;
- static validation as a hard gate;
- restricted bespoke component rules;
- writer approval before generated interactions are included;
- export artifacts should remain safe, portable, and self-contained according to the current MVP spec.

## Style Bias

Prefer:

- simple functions;
- explicit data flow;
- small commits/PRs;
- obvious names;
- testable boundaries;
- boring reliable code.

Avoid:

- premature frameworks inside the app;
- abstractions created for imagined future use;
- hidden global state;
- mixing product decisions into implementation;
- implementing unapproved scope.
