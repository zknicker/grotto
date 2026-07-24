---
summary: Agent profile — the single tabbed surface for an agent's identity, settings, session, activity, workspace, and tools, hosted on the Members page and in the chat right pane.
read_when:
  - changing the agent profile tabs, Members page, or agent avatar click targets
  - changing per-agent settings surfaces (model, web access, skills, tools, session reset)
  - changing session reset behavior or the new-session notice
---

# Agent Profile

One component family renders every per-agent surface: a six-tab profile —
Profile, Activity, Chat, Reminders, Workspace, Tools — with a persistent
header (face, name, description, live presence, and Message / Stop / Restart
actions). It absorbed the former agent drawer and the per-agent settings
pages; there is no other per-agent surface.

## Hosting

- **Members page** (`/members`, rail tab): AGENTS and HUMANS list on the
  left, profile detail at `/members/agents/:agentId`. This is the profile's
  full-page home.
- **Chat right pane**: clicking an agent's avatar in a chat transcript opens
  the same component in the resizable right pane. Artifact, profile, and
  thread panes share one-visible-pane arbitration and one width per chat —
  the most recent opener wins and every pane stays reopenable.
- Clicking an agent's **name** in a transcript header inserts an @mention
  into the composer instead; the DM topbar name is inert. Human
  participants have no profile pane.
- Old routes `/settings/agents/:agentId/*` redirect to
  `/members/agents/:agentId`.

## Tabs

- **Profile.** Identity (display name, description, character, color) as
  editable fields; model and thinking selects; session facts (effective
  model and provider, context fullness pairing Runtime `stats.contextTokens`
  with the model catalog window, turn count, started/last-activity, non-active
  status only); web access and task switches (capability-gated); runtime
  environment variables (runtime-global today); the agent's granted skills
  (enabled-first list plus searchable picker); session actions; delete.
- **Activity.** Timestamped diagnostics from the agent activity feed
  ([agent-activity](agent-activity.md)) with Copy Diagnostic Info. In-chat
  work-evidence groups move here when the turn model changes
  (specs/raft-alignment, I1).
- **Chat.** The agent's channels and DMs; agent-to-agent DM activity gets its
  own section once that concept exists.
- **Reminders.** Read-only view of the agent's schedules. Creation is
  conversational — the empty state says to tell the agent.
- **Workspace.** Read-only file tree and viewer over the agent's real
  workspace (MEMORY.md, notes/). The workspace is agent-maintained memory;
  identity steering is the Profile tab's editable description
  (specs/raft-alignment W2 — SOUL retired, no file editors here).
- **Tools.** Host tools and exact upstream MCP tools, grouped by connection.
  Discovery never grants a tool. Browser and `web_fetch` are host tools;
  `web_fetch` is granted to new agents by default.

## Session facts and resets

Unchanged contracts carried over from the drawer era:

- Session facts come from `agent.session`; the session's internal generation
  number never renders. `instructionsFresh: false` renders the "System
  prompt updated" notice. Past sessions list model, turn count, and end
  time, newest first.
- Resets are agent-wide: **Start fresh session** archives the current
  session; **Full reset** also wipes the workspace behind a destructive
  confirm. Both proxy Runtime `POST /agents/{agent_id}/session/reset` and
  land a durable `new_session` notice in the agent's DM. See
  [sessions](sessions.md).
- Reads never mutate: opening the profile never creates, resumes, or
  rotates a session.
- Session identity stays Runtime-owned; the app never invents session ids.
