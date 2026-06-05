# Update Protocol

This file defines how the Banderdash Engineering Manager updates project docs after meaningful PRs are merged or closed.

The Engineering Manager does not automatically know that a PR has been merged unless triggered.

## Trigger

Start with a manual trigger.

After a PR is merged or closed, Atul should ask:

```text
EM post-merge update for PR #<number>
```

Later, this can be automated through a GitHub webhook or scheduled check.

## Post-Merge / Post-Close Update Flow

When triggered, the Engineering Manager should:

1. Read the PR summary, linked issue, and final diff.
2. Inspect the relevant current code touched by the PR.
3. Decide whether the PR changed current engineering state, architecture, decisions, risks, or next priority.
4. Update `.banderdash-os/engineering-context.md` if current state, phase, risks, latest important changes, or next priority changed.
5. Update `.banderdash-os/architecture.md` only if system structure changed.
6. Update `.banderdash-os/decision-log.md` only if a major product or engineering decision was made.
7. If required docs were not updated in the PR, push back and either update them or recommend a follow-up docs PR.

## What Counts as Meaningful

A PR is meaningful if it changes any of these:

- implementation phase;
- package/module structure;
- workflow stages;
- SQLite schema or state model;
- provider abstraction;
- validation/sandbox/QA behavior;
- export/bundling behavior;
- frontend-backend communication;
- product scope;
- engineering risks;
- testing strategy;
- security/local-first constraints.

## Update Targets

### engineering-context.md

Update when:

- current project phase changes;
- important implementation progress lands;
- current risks change;
- next engineering priority changes;
- important PRs/issues should be remembered by future reviews.

Keep updates short. This file is current memory, not a full changelog.

### architecture.md

Update only when architecture changes.

Examples:

- new package boundary;
- changed data flow;
- changed workflow graph;
- changed state model;
- changed export architecture;
- changed validation or sandbox architecture;
- changed provider architecture.

Do not update for small bug fixes, copy changes, styling, or tests that do not change structure.

### decision-log.md

Update only for important decisions.

Examples:

- choosing one architecture over another;
- changing MVP scope;
- rejecting/defering a major feature direction;
- changing source-of-truth rules;
- changing security or local-first assumptions;
- changing EM/Developer workflow.

Do not record every merged PR.

## Post-Merge Output Template

```text
PR: #<number>

Docs updated:
- engineering-context.md: yes/no + reason
- architecture.md: yes/no + reason
- decision-log.md: yes/no + reason

Architecture changed:
- yes/no

Risks changed:
- yes/no

Next priority changed:
- yes/no

Follow-up needed:
- ...
```

## Automation Later

Possible future automation:

1. GitHub PR closed/merged webhook triggers Hermes.
2. Banderdash profile receives PR event.
3. Engineering Manager skill runs this protocol.
4. EM updates docs or comments required follow-up.

Start manually until the process feels stable.
