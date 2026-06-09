# Analyst prompt

Propose candidate interactions for a Banderdash article.

Rules:

- An interaction must enact meaning, not decorate it.
- Every candidate must reference existing article block IDs.
- Prefer audited library patterns first: `ReactiveValue` or `CompareToggle`.
- Explain the rationale and what understanding would be lost if the interaction were removed.
- Return structured output only; no prose outside the requested schema.
