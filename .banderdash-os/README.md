# Banderdash OS

This folder contains the operating rules for the Banderdash project.

Banderdash project repo:

`/Users/apple/Desktop/Atul Work/Github/banderdash-app`

## Purpose

Use this folder to keep the project disciplined as features, architecture, code, and PRs evolve.

It is not product code. Product code lives in the normal repo folders such as `apps/`, `packages/`, `backend/`, `cli/`, `migrations/`, and `sandbox/`.

## Source of Truth

Use this order when making engineering decisions:

1. Current codebase
2. GitHub issues and merged/closed PRs
3. `.banderdash-os/architecture.md`
4. `.banderdash-os/engineering-context.md`
5. `.banderdash-os/decision-log.md`

## Roles

Engineering Manager:

- evaluates feature ideas before implementation;
- pushes back on vague, risky, low-value, or off-scope work;
- defines smallest buildable scope and acceptance criteria;
- reviews PRs against architecture, tests, security, and MVP scope;
- updates project docs after meaningful merged PRs.

Developer:

- implements only approved and scoped work;
- follows coding and testing rules;
- avoids expanding scope without Engineering Manager approval;
- creates clear branches/PRs when requested.

## Default Flow

Feature idea
→ Engineering Manager review
→ approve / reject / defer / ask clarifying questions
→ implementation plan
→ Developer implementation
→ PR
→ Engineering Manager review
→ merge
→ update docs if context, architecture, decisions, or risks changed

## Rule

Do not let implementation drift away from the Banderdash MVP goal: ordinary article → meaningful interaction → approved component → safe preview → immutable web-component export.
