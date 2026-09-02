---
summary: Provider-hosted Cloud Agents as Agent-delegated work carried by durable Messages and executed through Computer-local provider access.
read_when:
  - adding or changing Cloud Agent tools, providers, lifecycle, cards, outputs, or completion delivery
  - changing Cursor runtime discovery, Cursor Cloud Agent authentication, or Cursor usage reporting
  - changing typed Message bodies, Agent creation proposals, or record-backed Message rendering
  - deciding whether delegated work belongs to a Grotto Agent, Harness subagent, Task, or provider-hosted Cloud Agent
---

# Cloud Agents

Cloud Agents let any Grotto Agent delegate bounded development work to a provider-hosted agent.
The delegating Agent starts the work, receives completion through its inbox, inspects the result,
and decides what to say or do next. Cursor is the first provider.

This spec is the canonical implementation plan. Earlier Fable and architecture reviews under
`~/.claude/plans` are research inputs and may describe superseded designs.

The product and architecture grill closed on 2026-09-02. Provider notes below are implementation
facts and compatibility risks, not unresolved product decisions.

## Product contract

- **One Agent tool.** Every supported execution runtime may call `CloudAgent`; the caller does not
  need to be a Cursor-backed Agent.
- **Provider-neutral capability.** Cursor is the only initial implementation, so an Agent does not
  pass a provider on every call. Computer configuration chooses the default if a second provider
  arrives; an explicit selector is added only when per-execution choice becomes useful.
- **Agent-held repository context.** The Agent supplies the repository, starting ref, title,
  instructions, and any other provider input it knows. Grotto adds no repository registry.
- **One durable Message.** Launch posts one Agent-authored Message in the initiating Chat. Its
  immutable `content` is the Agent's response to the request, supplied in the same `CloudAgent`
  invocation that starts the work. Its typed body is `cloud-agent-work`.
- **One work conversation.** A top-level work Message receives a child Thread immediately. Work
  launched inside an existing Thread stays in that Thread because Threads do not nest. Replying to
  the Message is the human steering and discussion surface; the card has no separate reply model.
- **One updating presentation.** Grotto App renders the Message's Cloud Agent work body as one card.
  The card updates from queued or running into a terminal report without creating automatic
  progress or completion Messages.
- **Inbox completion.** Every terminal provider run creates at most one durable inbox attention for
  the delegating Agent. Completion does not keep the launch turn open. The resumed Agent owns any
  follow-up and may post an ordinary Message when it has useful judgment to add.
- **Provider-hosted lifecycle.** Cloud Agent work may outlive a turn, App session, or Computer
  connection. Computer reconciles provider state after reconnect and reports bounded observations
  to Server idempotently.
- **Truthful launch failures.** Invalid input, unavailable capability, and missing authorization
  fail before creating a Message. Once Server accepts and records a launch, later provider failures
  settle the same card as failed instead of erasing the attempt.

Cloud Agent work is task-like but is not a Grotto Task. It has no assignee, claim, priority, label,
or board lifecycle, and a structured work Message cannot be promoted to a Task.

## Messages and cards

A Message is the only Chat transcript item. Every Message has stable identity, authorship,
conversation placement, sequence, and meaningful immutable content. A typed body augments that
content; it never replaces the Message's authored meaning.

```ts
type MessageBody =
    | { kind: 'text' }
    | { kind: 'agent-creation-proposal'; proposal: AgentCreationProposal }
    | { kind: 'cloud-agent-work'; work: CloudAgentWork };

type Message = {
    id: string;
    chatId: string;
    author: MessageAuthor;
    sequence: number;
    createdAt: string;
    content: string;
    body: MessageBody;
    attachments: Attachment[];
    task?: MessageTask;
};
```

Body kinds name concrete Grotto product acts, not generic mechanisms, rendered entities, or
providers. Grotto has no generic `prepared-action`, `cards[]`, or arbitrary JSON-block body. Agent
creation uses `agent-creation-proposal`; delegated hosted work uses `cloud-agent-work`; Cursor is a
provider field on that work. A pull request becomes a Message body only when a real workflow needs
to author a pull-request Message independently.

A card is presentation, not a durable noun. It owns no id, placement, lifecycle, authorization, or
data. Grotto App renders a card from the Message and the Server-owned record projected through its
typed body. Older clients and unknown body kinds render `content` instead.

Server has one Message reader that projects authors, attachments, Tasks, and typed bodies for every
consumer: Chat history, Threads, search, send receipts, Agent delivery, web, and iOS. Clients do not
join feature records into the transcript or infer a body kind from optional top-level fields.

## Canonical representation and migrations

Grotto stores and emits exactly one current representation for each body kind. Body payloads carry
no per-kind schema version, and readers do not retain historical variants indefinitely.

- Checked-in PostgreSQL migrations rewrite obsolete stored representations before new code depends
  on them. A failed canonical migration blocks activation rather than hiding history.
- Expand/contract deploys may retain an old wire field for one explicitly named, separately
  released client cycle. The compatibility path has a removal release and is then deleted.
- Unknown body kinds degrade through immutable Message `content`. This supports older clients and
  rollback; it is not a historical payload reader.
- Raw provider evidence may retain the provider's own revision at the Computer adapter. Provider
  revisions never enter the Message domain.

The prerequisite Message migration:

1. Adds `body_kind` to `chat_messages`, defaulting existing Messages to `text`.
2. Renames the Agent-creation proposal domain, tables, routes, events, shared contracts, App and iOS
   types, and documentation away from the legacy generic action terminology.
3. Backfills Agent-creation Message rows to `agent-creation-proposal` and replaces historical empty
   content with a deterministic description derived from the immutable proposal. New proposal and
   Cloud Agent tools require Agent-authored Message content.
4. Introduces the exhaustive `Message.body` contract and one Server Message reader. The old
   top-level proposal field survives only for the bounded iOS cutover.
5. Moves web and iOS to the body union, then removes the transitional field and every client-side
   empty-content or copy fallback.

Cloud Agent work lands only after this pipeline is canonical so it cannot copy the empty-anchor
pattern.

## Durable Cloud Agent work

Server stores one lifecycle-rich `CloudAgentWork` record for each work Message. The Message owns
authorship and Chat placement; the work owns mutable execution state.

```ts
type CloudAgentWork = {
    id: string;
    messageId: string;
    chatId: string;
    agentId: string;
    computerId: string;
    provider: 'cursor';
    providerAgentId: string | null;
    latestRunId: string | null;
    title: string;
    repository: string;
    startingRef: string | null;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'expired';
    summary: string | null;
    providerUrl: string | null;
    createdAt: string;
    updatedAt: string;
    terminalAt: string | null;
};
```

One work may contain several provider Runs. A follow-up, correction, or retry adds a Run to the
same work, reactivates the same card, and preserves earlier Run outcomes for inspection. A
substantively separate assignment creates a new Message and Cloud Agent work record. Cursor permits
only one active Run per provider Agent; an `agent_busy` response leaves the current Run unchanged.
A cancelled Run cannot resume, so continuing after cancellation creates another Run in the same
work and retains the cancelled Run's partial output.

The physical relationship is one-to-one: the work's `message_id` is unique and references the
Message. Creation is one Server transaction. `chat_messages.body_kind` and the related record must
agree; a missing or duplicate record is a mapping failure, never an empty card.

The Server record stores provider-safe identifiers and bounded state only. Provider prompts,
credentials, raw transcripts, tool traces, and hosted workspace files remain on Computer or with
the provider. Safe Server observations are Agent and Run ids, normalized and raw terminal status,
bounded result or error summary and error code, duration, per-Run token/cost usage when present,
provider URL, and reported Git branches and pull-request URLs. Streamed thinking, tool arguments,
shell output, and interaction deltas are execution evidence, not collaboration state.

Lifecycle changes emit a durable `cloud-agent-work.updated` event carrying the Message and work
identities. Events notify; refetching the Message recovers. The delegating Agent may cancel through
`CloudAgent`; human Owners and Admins may cancel through the card. Other Chat participants request
cancellation in the Thread. Reply and follow-up work use the work Thread rather than card-local
conversation controls.

## Outputs and pull requests

Cloud Agent work may produce zero or more outputs. Outputs are feature-owned typed relations, not
Message bodies and not a product-wide output framework. V1 records only the branches and pull
requests Cursor reports.

```ts
type CloudAgentWorkOutput =
    | { kind: 'git-branch'; repository: string; branch: string; observedRunId: string }
    | { kind: 'github-pull-request'; reference: PullRequestReference; observedRunId: string };
```

A pull request has identity independent of Cloud Agent work because it may also originate from a
human, local Agent, pasted URL, GitHub event, or routine. The produced-by relation records
provenance; it does not make the work record the owner of GitHub lifecycle.

The terminal work card renders produced pull requests as report rows. A pull-request URL in an
ordinary Message uses the same presentation grammar: compact when inline and card-like when it
stands alone. V1 stores the canonical URL and the bounded snapshot Cursor observed; it adds no
Server-global pull-request table or live GitHub state until a second writer or GitHub connection
creates a real need.

## Cursor readiness and authentication

Cursor runtime readiness and Cursor Cloud Agent readiness are related but independent Computer
capabilities:

| Capability | Ready when | Purpose |
| --- | --- | --- |
| Cursor runtime | `cursor-agent` is installed and its native session is usable | Local Cursor execution through an AI SDK harness adapter |
| Cursor Cloud Agent | `@cursor/sdk` resolves a user API key from explicit configuration, `CURSOR_API_KEY`, or `~/.cursor/sdk/auth.json` | Provider-hosted execution |

Grotto reuses provider-native state already present on the Computer. It does not scrape Cursor's
Keychain entries, copy credentials into Server, or invent a Grotto credential format.
`Cursor.auth.login()` is Cursor's supported one-time bootstrap when SDK authorization is absent; it
opens Cursor's browser flow and stores a revocable, expiring user API key in the SDK credential
store. In its disconnected state, Computer settings presents Cursor Cloud Agent as an optional
capability available to connect. An explicit human action starts the provider-owned browser flow;
Grotto never opens it during an Agent turn.

A user API key bills SDK and Cloud Agent work to the user's Cursor plan. Cursor runtime and Cloud
Agent readiness remain separate because the CLI and SDK use different credential stores even when
they belong to the same account. Cloud Agent providers form a Computer-specific capability category
separate from runtime harnesses; each Computer reports and onboards its own readiness.

## Ownership

| Layer | Owns |
| --- | --- |
| Grotto Server | Messages, Cloud Agent work records and outputs, authorization, lifecycle projection, durable events, and inbox completion |
| Grotto Computer | Provider discovery, SDK credential access, launch, reconciliation, cancellation, and detailed provider evidence |
| Grotto App | Message and card presentation, Thread discussion, progress and terminal outcomes, output actions, and Computer capability status |
| Cursor | Hosted Agent and Run lifecycle, repository checkout, workspace, transcript, branches, pull requests, artifacts, and billed usage |
| GitHub | Pull-request identity and lifecycle |

## Cursor implementation

The Cursor adapter uses the public `@cursor/sdk`, not Grok Bot's private services and not an
inferred CLI cloud command. `Agent.create()` returns a handle before provider persistence; the
initial `CloudAgent` operation performs the first `send()` that creates the hosted Run. Follow-ups
call `send()` on the same provider Agent.

Cursor Agent state and Run state remain distinct. An `IDLE` Agent does not prove successful
completion. Grotto settles work from the corresponding Run's `FINISHED`, `ERROR`, `CANCELLED`, or
`EXPIRED` result. Computer may consume provider events for live progress but always reconciles with
a Run read after missed events, reconnect, or restart. The SDK normalizes raw `EXPIRED` to `error`,
so Computer preserves the public raw status message when Grotto must distinguish expiry from an
ordinary failure.

Grotto supplies Cursor's Agent and Send idempotency keys, but Cursor does not document exactly-once
replay semantics for those headers. Grotto's own nonce, durable ids, conflict handling, and
reconciliation provide the product guarantee; provider idempotency is defense in depth.

Cursor's Cloud Agents API is public beta. The adapter isolates provider requests, responses, and
status mapping from Grotto's durable contracts. Repository validation happens at that adapter: a
repository is usable only when the Cursor account has the required source-control access.

## Settings and usage

Computer settings report Cursor runtime and Cursor Cloud Agent as separate capabilities even when
they use the same Cursor account. Cursor appears alongside other detected execution runtimes.
Grotto reports per-Agent and per-Run tokens and optional cost available through the public SDK; it
does not claim personal plan capacity, remaining allowance, or reset time because Cursor exposes no
supported public personal-account surface for them. Interactive CLI `/usage` reports activity and
streak statistics, not billing capacity. Team or Organization Admin usage requires a separate
administrative integration and is outside this Computer capability.

## Intentionally missing

- No repository registry, repository setup flow, or per-Server repository allowlist in v1.
- No requirement that the delegating Agent use the Cursor runtime.
- No representation of a Cloud Agent as a named Grotto teammate or Harness subagent.
- No product-wide generic action, card, output, or provider framework.
- No Server-hosted Cursor credential or raw provider transcript in Chat history.
- No provider selector until a second implementation creates a real choice.
- No GitHub-owned PR state, checks, reviews, or merge actions in v1.
- No automatic completion Message; the delegating Agent decides whether the result deserves one.

## Implementation sequence

1. Canonicalize Messages and rename Agent creation proposals.
2. Add Cursor runtime discovery and AI SDK harness support.
3. Add Cursor Cloud Agent readiness, SDK bootstrap guidance, and truthful usage reporting.
4. Add the `CloudAgent` tool, Computer adapter, durable Cloud Agent work record, work Message, and
   eager Thread.
5. Add lifecycle reporting, reconnect reconciliation, cancellation, durable events, and inbox
   completion.
6. Add web and iOS work-card presentation plus produced pull-request rows.
7. Run deterministic Server, API, Computer, App, and iOS coverage, then one opt-in live Cursor
   lifecycle smoke.

## Provider contract notes

- Pin the public-beta `@cursor/sdk` version and isolate all status and field mapping in the Cursor
  adapter. Live documentation and one downloadable OpenAPI snapshot currently disagree about the
  raw `IDLE` Agent status.
- Git metadata is an Agent-workspace snapshot, not guaranteed per-Run diff attribution.
- Optional provider cost can arrive eventually and does not represent account-plan allowance.
