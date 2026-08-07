---
summary: Documentation policy for product-first structure, routed frontmatter, contract language, reviews, and maintenance.
read_when:
  - adding docs, reorganizing docs, or changing documentation style
  - turning implementation notes, specs, or architecture decisions into docs
---

# Docs Policy

Grotto docs describe Grotto product contracts first. Implementation details are
allowed when they explain ownership or operational behavior, but they should not
become product nouns.

## Structure

- `docs/features/`: user-facing capabilities.
- `docs/api/`: API and SDK contracts.
- `docs/internals/`: architecture, Runtime, data model, frontend, and React
  conventions.
- `docs/operations/`: local development, testing, releases, and deployment.
- `docs/adr/`: accepted architecture decisions.
- `specs/`: deeper product contracts.

Every routed doc needs frontmatter:

```yaml
---
summary: One sentence.
read_when:
  - concrete trigger
---
```

## Language

Use product nouns directly: Chat, Channel, DM, participant, Agent seat, Agent
session, Agent turn, Runtime, model record, Tool, Skill, MCP connection, Memory,
automation.

Avoid docs that turn internal plumbing into user-visible features. Do not add
feature pages named after implementation layers such as frontend, server,
runtime records, or provider adapters.

## Contracts

State current behavior in present tense. Avoid migration diaries and stale
future-tense notes. If a doc must record a rejected or retired idea, keep it in
an ADR with an explicit status, not in a feature or API contract.

When behavior changes:

1. Update the API/spec/doc that owns the contract.
2. Update `read_when` hints if routing should change.
3. Remove stale implementation names instead of preserving aliases.
4. Prefer short, durable docs over broad research notes.

## Boundaries

Grotto Runtime owns values that affect execution: model provider setup,
executable model inventory, Agent default model, current Agent sessions, tool
inventory, sandbox mode, turns, and activity. Grotto App and Server are clients
and presentation layers.

Docs should keep that ownership clear.
