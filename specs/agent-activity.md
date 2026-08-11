---
summary: Agent activity — Server-persisted semantic work history, the live sidebar strip, avatar status dots, and Computer-local detailed execution evidence.
read_when:
  - changing Agent activity events, presence dots, or the sidebar activity strip
  - changing the Agent profile Activity tab or Turn Details drawer
  - changing Computer tool observation or the Server/Computer execution-evidence boundary
---

# Agent Activity

Agent activity answers two related questions without turning execution into Chat content:

- **What is happening now?** The Agent activity strip and status dots project current unsettled
  work.
- **What happened before?** Agent activity history is a durable chronological list of summarized
  execution events.

Activity is Agent-scoped because one Agent owns one global session and one turn may work across
several Chats. It carries a `runId`, never claims that one Chat owns the turn, and never enters the
Chat transcript.

## Semantic catalog

The public catalog is intentionally small. Copy is centralized and rendered with an ellipsis while
the category is current.

| Category | Current label | Evidence |
| --- | --- | --- |
| `starting_work` | `Starting work…` | Server admits a turn to its assigned Computer |
| `checking_messages` | `Checking messages…` | A structured Grotto message check/read/search boundary runs |
| `thinking` | `Thinking…` | Harness reasoning starts; content is discarded |
| `browsing` | `Browsing…` | A known Browser capability runs |
| `searching_web` | `Searching the web…` | A known provider or Grotto web-search capability runs |
| `reading_files` | `Reading files…` | A known file-read capability runs |
| `editing_files` | `Editing files…` | A known file-write/edit capability runs |
| `running_command` | `Running a command…` | A known shell/process capability runs |
| `using_tool` | `Using a tool…` or `Using <safe name>…` | A known safe tool identity has no narrower category |
| `sending_message` | `Sending a message…` | Server begins the canonical Agent message-send boundary |
| `working` | `Working…` | No narrower truthful category is current |

Completed and failed phases appear in history with past-tense copy. The strip never adds a
synthetic `Finished` row; the Agent leaves the strip when its turn settles.

## Mapping evidence to activity

Mapping is conservative and versioned. Prefer a less-specific truthful category over a specific
inference.

1. **Grotto product boundaries** map directly. Message checks come from the structured local proxy;
   sends and turn lifecycle come from Server write boundaries.
2. **Known tools** map through an explicit registry owned by the Computer activity projector.
   Provider-specific Codex, Claude, and Pi identities have fixture-backed mappings. Grotto-owned
   host tools declare their category at registration.
3. **Unknown and MCP tools** default to `using_tool`. Their names, descriptions, and inputs are not
   parsed for intent. A tool named `search` does not prove web search; `cat` inside a shell command
   does not turn a shell event into file reading.

An optional tool label crosses only when it is a canonical Grotto-controlled display identity.
Unknown native or third-party names remain Computer-local and render `Using a tool…`.

## Event contract

Server and Computer produce the same narrow event shape:

```ts
type AgentActivityEvent = {
  id: string
  agentId: string
  runId: string
  position: number
  producer: "server" | "computer"
  producerId: string
  producerSequence: number
  category: AgentActivityCategory
  phase: "started" | "completed" | "failed"
  occurredAt: string
  toolRef?: string
}
```

Each producer assigns a monotonic `producerSequence` within the run. Server validates the currently
assigned Computer and active run, deduplicates `(serverId, agentId, runId, producer,
producerId, producerSequence)`, assigns the next run-local `position` while holding the owning
delivery/turn lock, persists the event, then broadcasts it. `position` is the only presentation
order; producer timestamps never resolve cross-machine ordering. Server-originated lifecycle events
use their own producer identity and the same ordered journal without pretending they came from
Harness.

Heartbeats and repeated identical current states are not persisted. Short adjacent events may be
coalesced for the live strip, but every meaningful transition remains available in history.

Activity events never contain reasoning text, model narration, draft messages, URLs, search terms,
paths, commands, tool inputs or outputs, authorization data, or private file contents.

## Computer projection and execution journal

One raw Harness event fans into two deliberately separate products:

```text
Harness tool call/result
  -> Computer-local execution journal (detailed)
  -> Computer activity projector (semantic) -> Server activity journal
```

The **Agent execution journal** is keyed by `runId` and retains tool-call ids, exact observed tool
identity, inputs, outputs, errors, and timings. It excludes model reasoning. It stays on Computer;
Server Owners and Admins may inspect it through an authorized live Server-to-Computer relay. Server
does not persist the response. When Computer is offline, detailed evidence is unavailable.

This workstream assigns no retention or cleanup policy to the execution journal. Holistic cleanup
is owned by Linear PRD-216.

## Surfaces

### Agent activity strip

The strip sits at the bottom of every Server sidebar and is absent from full-width destinations
without a sidebar, including Search and Reminders.

- Membership is exactly the Server's Agents with unsettled turns.
- Each row shows the Agent avatar with its ordinary global status dot plus the latest semantic
  activity label.
- Show at most four rows, then `N more working`.
- Order is stable by turn start, oldest first. A category change does not reorder rows. Entry and
  exit reflow with a restrained layout animation; reduced-motion users get no rerank motion.
- Clicking a row opens that Agent's profile.
- Settlement removes the row with a short fade. Status dots never pulse.

The strip consumes live current-state projection, not the historical query. Reconnect obtains a
current active-activity snapshot before applying later events.

### Agent activity history

The Agent profile Activity tab reads the durable Server journal newest-first with pagination. It
shows lifecycle and semantic tool-category rows similar to Raft's Activity diagnostics. Repeated
heartbeats and raw details never appear.

Every Server member may see the summarized history. Complete execution evidence is restricted to
Server Owners and Admins and remains Computer-local. Agent creation provenance grants no additional
access.

This workstream adds no expiry or pruning to Server activity history. Any holistic retention change
belongs to PRD-216.

### Turn Details

An Agent-authored Chat message stores the real `runId` that produced it. Its Turn Details drawer
shows the Server-persisted activity summary to members who can access that message. Owners and
Admins may additionally request the run's detailed execution journal while Computer is online.

A global turn may touch several private Chats. Ordinary members never receive global raw evidence
through one Chat message. Opening a Chat never fetches detailed evidence until the user explicitly
opens Turn Details.

### Avatar status dots

Agent avatars in the Chat transcript render the same global status dot as Agent avatars in the
sidebar and profile. The dot answers whether that Agent is currently working anywhere on the
Server; it is not Chat-scoped and never pulses.

DM headers mirror global Agent status with concise text such as `Online`, `Working`, `Offline`,
`Stopped`, or `Needs attention`. Channel headers do not aggregate Agent status.

## Failure behavior

- Server history remains readable while Computer is offline.
- A missing live activity update falls back to `Working…` while the unsettled turn remains known.
- Computer disconnect clears current strip membership through Agent availability reconciliation;
  it does not delete durable history.
- Unknown tools stay generic. Classification failure never blocks the turn or tool call.
- Activity transport is best effort during a turn. Settlement must still record the terminal turn
  outcome even if intermediate semantic events were lost.

## Non-goals

- Streaming model text or reasoning into Activity.
- Guessing intent from arbitrary tool names, arguments, commands, or output.
- Showing raw execution evidence in the sidebar or ordinary-member Activity views.
- Treating activity as Chat history, typing state, or a promise that the Agent will reply.
- Defining retention or cleanup policy.
