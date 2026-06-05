# Product Goal

Banderdash should become a seamless working product that helps writers turn ordinary articles into meaningful interactive articles.

The product should feel useful, controlled, and reliable: a writer brings prose, the system identifies places where interaction can deepen understanding, the writer approves or rejects those ideas, and the final output can be previewed and exported cleanly.

## Core Principle

An interaction must enact meaning, not decorate it.

It earns its place only if removing it would cost the reader understanding, not just visual interest.

## Product Goal

Build a high-quality interactive article platform that:

- helps writers make articles more understandable, memorable, and engaging;
- keeps the writer in control of what gets added;
- avoids gimmicky interactions and visual noise;
- produces clean, reliable, portable article outputs;
- feels simple enough to use without understanding the underlying engineering;
- is implemented with clean, maintainable, well-tested code.

## Engineering Goal

The product should be built with strong engineering discipline:

- clear architecture;
- small, testable implementation steps;
- readable TypeScript and Svelte code;
- explicit boundaries between editor, workflow, components, validation, and export;
- security and safety constraints treated as product requirements, not afterthoughts;
- documentation kept current when architecture or major behavior changes.

## Current MVP Direction

The current MVP direction is defined in:

`interactive-article-platform-implementation.md`

That specification is the detailed implementation source for the first major build.

This product goal stays more general: it defines the quality bar and purpose, while the implementation spec defines the current build shape.

## Pushback Rules

Push back on any feature or implementation choice that:

- makes the product harder to understand or use;
- adds interaction for decoration rather than meaning;
- expands scope before the core workflow works end-to-end;
- weakens code quality, testability, or maintainability;
- creates architecture complexity without clear user value;
- reduces writer control;
- conflicts with the current MVP specification without an explicit decision to change direction.

## Success Definition

The project is succeeding when a writer can move from raw article text to a reviewed, meaningful, previewed, and exportable interactive article through a smooth workflow backed by clean engineering.
