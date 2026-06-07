# Decision Log

This file records important Banderdash product and engineering decisions.

Do not record every small change. Record decisions that affect product direction, engineering process, architecture, scope, or long-term project behavior.

## 2026-06-05 — Use One Banderdash Hermes Profile

Decision:
Use one dedicated Hermes profile named `banderdash` for Banderdash project work.

Reason:
This keeps Banderdash-specific behavior, memory, and project rules separate from the default personal Hermes profile.

## 2026-06-05 — Start With One Engineering Manager and One Developer Role

Decision:
Start with a simple two-role structure:

- Engineering Manager: evaluates features, pushes back, defines scope, reviews PRs, updates engineering docs.
- Developer: implements approved scoped work, follows coding/testing rules, and prepares PRs.

Reason:
This is simpler than many specialist managers and keeps responsibility clear.

## 2026-06-05 — Use `.banderdash-os/` as Project Operating Folder

Decision:
Create `.banderdash-os/` inside the Banderdash repo for project operating docs.

Reason:
The project needs a lightweight system for engineering context, architecture, feature review, PR review, and decision tracking without overcomplicating the repo.

## 2026-06-05 — Keep All Project Work Inside `banderdash-app`

Decision:
Use `/Users/apple/Desktop/Atul Work/Github/banderdash-app` as the working folder for Banderdash.

Reason:
All product code, project docs, implementation plans, and operating docs should live under one repo folder.

## 2026-06-05 — Treat Current Code and GitHub PRs as Engineering Source of Truth

Decision:
For engineering decisions, use this source-of-truth order:

1. Current codebase
2. GitHub issues and merged/closed PRs
3. `.banderdash-os/architecture.md`
4. `.banderdash-os/engineering-context.md`
5. `.banderdash-os/decision-log.md`

Reason:
The Engineering Manager should not rely on hidden chat memory. Project truth should live in code, GitHub history, and repo docs.

## 2026-06-05 — Product Goal Stays General; Implementation Spec Stays Detailed

Decision:
Keep `.banderdash-os/product-goal.md` general and quality-focused. Keep `interactive-article-platform-implementation.md` as the detailed MVP implementation source.

Reason:
The product goal should define purpose and quality bar. The implementation spec should define the current technical build plan.

## 2026-06-07 — Use Node Built-in SQLite for the MVP State Foundation

Decision:
Use Node's built-in `node:sqlite` API for the first SQLite state-store foundation.

Reason:
The implementation plan preferred `better-sqlite3` unless install/platform issues appeared. In this repo path and current Node environment, `better-sqlite3` failed native installation because no prebuilt binary was available and `node-gyp`/make broke on the path containing spaces. The built-in SQLite API avoids native package installation and keeps the local-first state-store PR small and testable.

Tradeoff:
`node:sqlite` is currently experimental in this Node version, so revisit if it becomes unstable or if the project standardizes on a supported LTS Node/runtime.
