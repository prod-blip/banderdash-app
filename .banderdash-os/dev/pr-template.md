# PR Template

Use this template for meaningful Banderdash pull requests.

```text
## What changed

- 

## Why

- 

## Approved scope / linked issue

- Issue/approval:
- Scope summary:

## Tests / verification

- Commands run:
- Manual checks:
- If no automated tests were added, explain why:

## Architecture impact

- Does this change architecture? yes/no
- If yes, what changed?
- Was `.banderdash-os/architecture.md` updated? yes/no/not needed

## Docs impact

- `.banderdash-os/engineering-context.md`: updated / not needed
- `.banderdash-os/architecture.md`: updated / not needed
- `.banderdash-os/decision-log.md`: updated / not needed

## Security / local-first impact

- Does this affect local-first behavior, validation, sandboxing, generated code, or export safety? yes/no
- If yes, explain:

## Known risks / tradeoffs

- 

## Out of scope

- 
```

## Rule

If the PR cannot be explained clearly with this template, the scope is probably too vague or too large.

Split large PRs into smaller reviewable PRs before asking for Engineering Manager review.
