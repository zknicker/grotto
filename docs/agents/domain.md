---
summary: Domain-document layout for engineering skills in Grotto.
read_when:
  - using architecture, diagnosis, domain-modeling, or TDD skills in this repo
  - changing where Grotto domain context or ADRs live
---

# Domain docs

Grotto uses a single-context domain-doc layout.

## Before exploring, read these

- `CONTEXT.md` at the repo root, if present.
- `docs/adr/` for ADRs that touch the area about to change, if present.

If these files do not exist, proceed silently. Do not flag their absence or create them upfront.
Domain-modeling flows create them when terms or architectural decisions need to be recorded.

## File structure

```text
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-example-decision.md
│   └── 0002-example-decision.md
└── docs/agents/
```

## Use the domain vocabulary

When output names a domain concept in an issue title, refactor proposal, hypothesis, or test name,
use the term as defined in `CONTEXT.md`.

If the needed concept is not in the glossary yet, note the gap for a domain-modeling pass.

## Flag ADR conflicts

If output contradicts an existing ADR, surface the conflict explicitly instead of silently
overriding the decision.
