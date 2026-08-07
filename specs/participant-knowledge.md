# Participant Knowledge

Participant knowledge is Grotto's structured knowledge about people and between people.

It connects the participant model to memory. Instead of treating people as names embedded in text,
Grotto should store durable person knowledge in forms that answer three questions clearly:

- who is this about
- whose view is this
- how does this connect to other people

The canonical bridge for this knowledge is `participant`. Platform accounts and observed sender
identities should resolve to a participant first. Structured person knowledge should then attach to
that participant.

## Relationship To Other Systems

Participant knowledge sits between participants and memory.

- `participants` define canonical identity.
- `participant identities` are the platform-scoped source identities that resolve into a
  participant.
- `participant observations` capture durable knowledge about a participant.
- `participant relationships` capture durable links between participants.
- Memory remains the underlying long-term store that preserves this knowledge over time.
- `activity log` captures recent activity, not long-term person knowledge.
- `participant context` renders active people using participant identity, participant observations,
  participant relationships, and recent activity.

Participant knowledge should mesh with the memory system, not sit beside it as an unrelated second
brain.

This means person memory should not be keyed directly by Discord user IDs, Telegram handles, or
display names. Those source identities are the resolution path into the participant, not the final
owner of person knowledge.

## Participant Observations

A participant observation is a durable statement about a participant.

- Every participant observation should have a clear subject participant.
- A participant observation may also have an observer scope.
- A participant observation may come from a direct statement, an agent action, a system event, or
  a later inference.
- A participant observation should preserve provenance, recency, and whether it is current,
  superseded, contradicted, uncertain, or otherwise inactive.

Participant observations should reuse Memory note types, tags, links, and timeline entries where
appropriate, including:

- `identity`
- `fact`
- `preference`
- `goal`
- `event`
- `observation`

This keeps person knowledge aligned with the rest of the memory model instead of inventing a
completely separate fact system.

### Observation Scope

Observation scope defines whose view a piece of participant knowledge belongs to.

- Some participant observations belong to the agent's own durable understanding.
- Some participant observations belong to a participant-specific observation scope such as what one
  participant knows about another.
- Some participant observations may be shared at a workspace or project level when that scope is
  intentional and appropriate.

Grotto should not flatten all participant knowledge into one omniscient global pile.

The same subject participant may therefore have:

- shared observations
- agent-owned observations
- observer-scoped observations from one participant about another participant

These scopes may overlap, but they are not interchangeable.

### Scope Model

Participant observations and participant relationships should use an explicit scope model.

- `shared`: knowledge intended to be available across the agent's relevant shared Wiki space
- `agent`: the agent's own durable understanding about a participant
- `participant`: a participant-specific point of view about another participant

Every participant-knowledge record should therefore preserve:

- the subject participant
- the scope kind
- the owning agent or shared Wiki space
- the observer participant when the scope kind is `participant`

Observer-scoped knowledge lets Grotto represent "A thinks B prefers email" separately from "the
agent knows B prefers email."

## Participant Relationships

A participant relationship is a durable link between two participants.

Relationships are not just profile facts. They describe how people connect to one another.

- A participant relationship should identify both sides of the relationship.
- A participant relationship should preserve direction when direction matters.
- A participant relationship should preserve status, such as current, past, tentative, disputed, or
  superseded.
- A participant relationship should preserve scope using the same `shared`, `agent`, and
  `participant` model as participant observations when point of view matters.
- A participant relationship should preserve provenance and recency like any other Memory fact.

Grotto should support durable relationship types such as:

- organizational relationships such as `manages` and `reports_to`
- collaboration relationships such as `works_with` and `partners_with`
- dependency relationships such as `owns`, `maintains`, and `blocked_by`
- social or personal relationships when those are intentionally relevant

The relationship taxonomy may grow, but the important product rule is that relationships are
first-class and typed, not just prose hidden inside freeform memories.

Chat co-presence is not itself a relationship. Two people appearing in the same conversation should
not automatically create durable relationship knowledge.

## Capture Rules

Participant knowledge should be captured against observed participants.

- The system should first resolve the observed source identity into a participant.
- When the speaker is known, observations about that speaker should attach to that participant
  directly.
- When a message or action clearly refers to another identified participant, the observation should
  attach to that participant rather than to a name string.
- When a message clearly expresses a relationship between two identified participants, Grotto should
  capture that as a participant relationship.
- When the referent is ambiguous, Grotto should not silently create participant-specific knowledge
  under one guessed participant.

Grotto should prefer unresolved participant knowledge over incorrect participant knowledge.

For auditability, the captured knowledge should still preserve which source identity, message, or
platform event it came from.

## Recall And Prompt Use

Participant knowledge should be recalled and rendered by participant identity first, not by fuzzy
name matching.

- Participant-specific recall should start from participant identity and then include relevant
  shared context.
- Observer-scoped observations should only appear when that observer scope is relevant to the
  current session.
- Participant context should prioritize the active participants in the current session.
- Current relationships should surface ahead of stale or superseded ones when both are relevant.

When active participants share a display name, prompt-facing participant context should render them
with enough disambiguation that the agent can keep them apart.

## Product Surfaces

Grotto should expose participant knowledge as something inspectable and understandable.

- A participant surface should make it possible to inspect that participant's durable observations.
- A participant surface should make current and historical relationships understandable.
- Same-name participants should remain visibly distinct.
- Product surfaces should make it understandable whether a statement is shared knowledge,
  agent-owned knowledge, or observer-scoped participant knowledge.

## Constraints

- Participant knowledge must not be keyed primarily by display name.
- Participant knowledge must not silently merge same-name participants.
- Observer-scoped knowledge must not leak into unrelated participant contexts.
- Relationship capture must not mistake simple co-presence for a durable relationship.
- Participant knowledge must preserve enough provenance that operators can understand what Grotto
  knows, whose view it belongs to, and why.
