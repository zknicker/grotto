---
summary: Development chat demos for exercising Grotto chat UI through seeded Runtime chat messages.
read_when:
  - changing dev-only chat demos
  - changing seeded Runtime chat examples
  - replacing static chat preview routes with real chat data
---

# Chat Demos

Chat demos are dev-only Grotto chats seeded into Runtime SQLite
(`apps/runtime/src/tavern/development-chat-demos.ts`, chat content in
`development-chat-demo-*-definitions.ts`). They let the app exercise the
normal chat list, chat detail, and timeline code paths without asking an
agent to generate data. Since ADR 0014, the timeline is durable messages
only, so demos seed plain `chat_messages` rows (author, role, content,
attachments, timestamp) — there is no response/activity/artifact demo
projection to maintain.

## Contract

* The dev stack sets `TAVERN_DEV_STACK=1`; Runtime startup seeds demo chats
  only when that flag is present.
* Seeding is create-only for rows a user or real turn may have touched:
  reseeding never retitles or relabels an already-observed chat or
  participant.
* `obsoleteDevelopmentChatDemoIds` (`@tavern/api/development-chat-demos`)
  lists retired demo chat ids; seeding prunes their messages, participants,
  reads, events, and any legacy `chat_responses` / `chat_response_activity` /
  `chat_deliveries` / `chat_artifacts` rows they still carry, so local
  workspaces converge without stale stable-id conflicts.
* Each demo chat is a normal Grotto chat. It appears in the sidebar channel
  list with its seeded color and opens through `/chats/:id`. Do not add a
  separate Demos tab, lab route, or preview-only page for them.
* Do not add route-local transcript fixtures for demo coverage. If a demo
  needs to show a chat behavior, seed the Runtime message rows that live
  chat would read.

## Current demos

| Chat | Demonstrates |
| --- | --- |
| `cht_demo` (`demo`) | A representative colored channel combining artifact links, long-token wrapping, attachments, and self-message history. |
| `team-demo` | A multi-agent channel with two agent seats. |
| `visuals` | A channel showing seeded HTML/artifact-style visual turns. |
