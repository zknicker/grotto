# Tranche 5 audit — MCP, skills, and Agent workspace

Audit date: 2026-07-29  
Grotto revision: `f7f3f8f91`  
Status: corrective implementation and focused/live verification complete

## Corrective implementation

| Finding | Resolution |
| --- | --- |
| Unavailable MCP blocks startup | Discovery is concurrent and bounded to five seconds per connection; one failure is omitted independently. Invocation is bounded to 30 seconds. |
| Hosted workspace links fail | Hosted message targets carry the author Agent id through the pane key and Server/Computer read relay. Same-path files from different Agents stay distinct. |
| Skill import completion races | Computer durably records `accepted`, waits on the Agent-run settlement event, then records and reports `applied` or `failed`. The App renders those reported states without polling or elapsed-time guesses. |
| MCP errors collapse | Denied, reauthorization, timeout, and unavailable failures retain stable codes through Computer tool execution. |
| MCP health appears stale | `connected` is explicitly the retained connection identity, not a live health claim. Bounded operations expose current upstream failures without erasing configuration or grants. |
| Skill inventory/metadata malformed | Sources are canonical-path and destination-name deduplicated by root precedence, and YAML frontmatter is parsed as YAML. |
| Skill traversal unbounded | Bundles are binary-safe, atomic, skip symlinks, and enforce depth, file-count, per-file, and total-byte limits. |
| Operator skill management missing | Owner/Admin can live-read, hash-guard edit, and explicitly confirm deletion of an Agent-local skill copy. Bytes transit the relay but are never persisted by Server. |
| Workspace cache/presentation weak | Server events plus explicit Refresh invalidate workspace queries. The UI exposes hidden files on demand while continuing to block sensitive/heavy paths, and shows size, modified time, truncation, and Markdown Preview/Raw. |
| Execution evidence coarse | Compact turn evidence includes bounded safe tool names, including MCP tool identity, without arguments, commands, reasoning, or private file content. |

## Post-fix verification

- Focused deterministic lanes cover MCP discovery/invocation timeouts, stable
  failure codes, revocation, durable skill imports, restart recovery, bounded
  bundle copying, workspace visibility, author-scoped artifact reads, and
  event-driven query invalidation.
- In a fresh Grotto dev stack, an Owner imported one skill into a live Agent,
  read and edited its independent `SKILL.md`, confirmed the edit persisted,
  then deleted the temporary copy. The Agent inventory returned to its original
  two skills.
- The same live Agent workspace exposed explicit Refresh and hidden-file
  controls. The hidden-file control changed state immediately and the workspace
  remained available after refresh.
- MCP success/revocation was already observed during the audit. The corrective
  timeout and failure distinctions are verified in deterministic Server and
  Computer lanes because those are safer and more precise than inducing live
  upstream failures.

## Method

1. Read the Raft Computer/daemon implementation and the corresponding Grotto
   Computer, Server, App, and CLI paths.
2. Use Raft and Grotto as an ordinary user with matched requests.
3. Record the observed product result and the execution evidence exposed by
   each product.
4. Separate intended Grotto product differences from implementation defects.

Live evidence remains in:

- Raft `#market-ops-brief`:
  `https://app.raft.build/s/arcade/channel/2108bfb7-ede8-4d18-9f73-9f43128b56c5`
- Grotto `#market-ops-brief`: chat `cht_oa0RoXz1vIPqBs9Z`
- Grotto Wren DM: chat `cht_yAsSoU_pnAQr7c1G`

## Scenario results

| Scenario | Raft | Grotto | Result |
| --- | --- | --- | --- |
| Managed MCP call | Bob used the connected Linear MCP `get_issue` tool and returned the correct PRD-155 title/status. Activity and the MCP tab exposed the exact tool and usage. | Wren used a temporary Server-owned MCP connection and returned the same correct title/status. | Core call path passes. Grotto lacks comparable tool-use evidence. |
| MCP grant revocation | Raft's Computer contract re-fetches the catalog and versions assignments so stale tools fail closed. | After revoking Wren's connection grant, the same request did not execute the tool. Wren reported that the service was “refusing connections.” | Authorization passes; diagnostics fail. |
| Skill-backed answer | Bob read `decision-helper/SKILL.md` and produced a structured recommendation. Activity exposed the skill file read. | Wren imported `decision-helper` and produced a similarly structured recommendation on the next turn. Activity only reported “Sent 1 message(s).” | Behavior passes; import UX, metadata, and observability do not. |
| Workspace create/read | Bob created `notes/market-ops-brief.md`; Raft exposed a tree, refresh, hidden toggle, size/mtime, and Raw/Preview. | Wren created the same file and the Agent Workspace tab read its exact contents. | Core persistence passes. |
| Workspace link from chat | Raft's Agent workspace exposed the created file normally. | Wren returned a `grotto://workspace/...` link, but clicking it in hosted chat did nothing. | Grotto fails. |

## Confirmed strengths

- Server owns remote MCP connections, credentials, discovery, and invocation.
- One per-Agent connection grant enables the connection's complete tool set;
  there is no per-tool grant ceremony.
- Invocation re-checks the current grant and fails closed after revocation.
- Each Agent has one isolated, Computer-local skill library and workspace.
- Imported skills become available on the next turn without restarting the
  Computer.
- Workspace content persists locally and is readable through the authorized
  Server relay.

## Findings

### P1 — one unavailable MCP connection can block Agent startup

`HostedMcpRuntime.listAgentTools` isolates thrown failures, but neither MCP
client creation, discovery, nor invocation has a time bound. Computer launch
awaits the complete Server tool catalog before starting the Agent. A remote MCP
that never resolves can therefore stall the whole catalog and Agent launch,
contradicting `specs/mcp.md`.

Required correction: bounded discovery and invocation per connection, with
failed connections omitted independently.

### P1 — hosted chat does not open Agent workspace artifacts

The hosted chat builds an empty artifact target list and no-op target handlers.
It also guesses `peerAgentId ?? agents[0]`, which is ambiguous in channels.
Workspace resource targets do not identify the owning Agent. The live
`grotto://workspace/...` click reproduced the failure.

Required correction: make workspace targets identify the Agent, route them
through hosted artifact state, and fetch with both Server and Agent identity.

### P1 — skill import completion is racy

Computer waits for an active turn with a 10 ms busy loop before applying an
import, while Server gives the import request a 30 second deadline. A long turn
can make the App report failure even though the import later succeeds.

Required correction: acknowledge durable import acceptance separately from
turn-boundary application, publish completion as an event, and remove the busy
poll.

### P2 — MCP errors collapse denial and outage

Every invocation failure becomes HTTP 403 `MCP_DENIED`. The live revoke
scenario therefore produced the misleading user-facing diagnosis “service is
refusing connections” instead of access revoked/unavailable.

Required correction: preserve narrow error classes for revoked access,
upstream authentication, timeout, and upstream outage.

### P2 — MCP health can become stale

Connection status reflects successful setup/discovery, not the result of a
later live call. A broken connection may remain visually online.

Required correction: update connection health from bounded live failures and
recoveries without removing configuration or grants.

### P2 — skill inventory is duplicated and metadata is malformed

The live Settings → Skills inventory showed duplicate sources and descriptions
such as `|` and `---`. Discovery traverses overlapping symlinked host roots,
does not canonicalize source identity, and uses a shallow frontmatter parser.

Required correction: canonical-path deduplication and standards-compliant
frontmatter parsing.

### P2 — skill bundles lack safe traversal bounds

Import/scanning reads support files as UTF-8 and has no total byte, file-count,
or depth cap. Binary assets are unsafe and a large bundle can consume
unbounded work.

Required correction: bounded bundle traversal, binary-safe copying, and
metadata-only text parsing.

### P2 — operator skill management is incomplete

The App can list and import Agent skills, but it does not expose the specified
view/edit/delete operations for an Agent-owned copy. The Agent CLI supports
them, so the capability exists below the App.

Required correction: add live-relay view/edit/delete UI with explicit deletion
confirmation; keep skill content Computer-local.

### P2 — workspace cache and presentation are weaker than Raft

The App caches directory results indefinitely and receives no workspace-change
event. It lacks manual refresh, hidden-file control, file size/modified time,
truncation disclosure, and Markdown Raw/Preview.

Required correction: workspace change invalidation plus Raft-equivalent
truthfulness and viewing controls.

### P2 — execution evidence is too coarse

Raft Activity showed the exact MCP tool and skill file read. Grotto Activity
only showed `completed Sent 1 message(s)`, making successful behavior difficult
to audit or debug.

Required correction: project safe MCP/skill/workspace activity facts without
exposing secrets or raw private content.

## Intentional differences, not defects

- Grotto keeps MCP credentials and execution on Server; Computer receives only
  scoped tools. This is the approved hosted model.
- A Grotto grant is connection-level, not per-tool.
- Grotto skills are isolated per Agent and imported from host sources. Raft
  discovers ambient host-global skills. The Grotto model is deliberately safer
  and should remain.
- The current Grotto Agent MCP tab is an explicit access-control surface,
  whereas Raft's live tab emphasizes usage. Removing per-Agent access control
  is not implied by this audit.

## Documentation drift to fix with implementation

- `specs/skills.md` still describes Runtime ownership and exact MCP tool grants.
- `specs/workspace.md` still describes Server-owned skill assignment.
- `docs/features/skills.md` says MCP credentials stay on Computer and describes
  exact grants.

`specs/mcp.md` and the Raft alignment program contain the current ownership
model.
