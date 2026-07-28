---
summary: Agent profile — the single Server-backed surface for an agent's identity, configuration, activity, chats, reminders, workspace, apps, and MCP access.
read_when:
  - changing the agent profile tabs, Members page, or agent avatar click targets
  - changing per-agent settings surfaces, Server APIs, or Computer-backed workspace access
---

# Agent Profile

One component family renders every per-agent surface: a seven-tab profile —
Profile, Activity, Chat, Reminders, Workspace, Apps, MCP — with a persistent
header (face, name, live presence, and Message / Stop / Restart actions).
There is no separate per-agent settings surface.

## Hosting

- **Members page** (`/s/:serverSlug/members`, rail tab): AGENTS and HUMANS
  list on the left, profile detail at
  `/s/:serverSlug/members/agents/:agentId`. This is the profile's full-page
  home.
- **Chat right pane**: clicking an agent's avatar in a chat transcript opens
  the same component in the resizable right pane. Artifact, profile, and
  thread panes share one-visible-pane arbitration and one width per chat —
  the most recent opener wins and every pane stays reopenable.
- Clicking an agent's **name** in a transcript header inserts an @mention
  into the composer instead; the DM topbar name is inert. Human
  participants have no profile pane.

## Tabs

- **Profile.** Server-owned identity and role; desired Computer/runtime/model
  assignment; effective state reported by the Computer; Agent-owned skills
  reported by the Computer.
- **Activity.** Timestamped, turn-grained diagnostics from durable Server
  records ([agent-activity](agent-activity.md)) with Copy Diagnostic Info.
- **Chat.** Server-owned channels and DMs in which the Agent participates.
- **Reminders.** Read-only view of the agent's schedules. Creation is
  conversational — the empty state says to tell the agent.
- **Workspace.** Read-only file tree and viewer over the agent's real
  Computer workspace through an authorized live Server↔Computer relay. The
  Server does not replicate workspace files.
- **Apps.** Accounts the Agent uses through browser-based app access.
- **MCP.** Server-managed MCP connections granted at connection level.
  Tavern does not expose per-tool grants or local/stdin MCP configuration.

## Ownership

- The Server owns Agent identity, membership, configuration intent, chats,
  activity summaries, reminders, MCP connections, and access grants.
- The Computer owns execution, workspace files, credentials, and effective
  runtime state.
- The browser talks only to the Server through typed tRPC procedures. It
  never invokes a Computer directly.
- Reads never start, resume, rotate, or otherwise mutate Agent execution.
