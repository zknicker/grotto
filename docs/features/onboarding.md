---
summary: Mandatory fresh-Server setup through the first usable Computer and into Meet Cove.
read_when:
  - changing fresh-Server creation, first-Computer setup, the Server shell gate, or Cove onboarding UI
---

# Fresh-Server Onboarding

Every newly created Server begins in mandatory setup. Creation atomically keeps
the existing first Owner and `#all` guarantees while adding durable onboarding
progress and private `#onboarding-owner`, initially containing only that Owner.
No Computer, Agent, or execution configuration is created automatically.

The first step gives the Owner the Grotto Computer install and Server-specific
setup commands. A Computer connection records live progress but does not
advance setup. The Server advances from `awaiting-computer` to
`awaiting-cove` only after that Computer reports at least one runtime with at
least one model. Empty or invalid inventory, protocol incompatibility, and
disconnection remain on the owning durable phase with a concrete repair
message. Reload, App restart, Server restart, and reconnect therefore resume
from Server state instead of reconstructing progress.

The App owns no onboarding authority. The `/s/:slug` route reads the Server's
onboarding record before mounting `ServerLayout`; while setup is incomplete,
every nested destination renders the dedicated HeroUI onboarding feature
instead of the rail, sidebar, Chats, Members, Tasks, Computers, or Settings.
Computer events invalidate that focused Server read, so the view advances live
without polling.

The first-Computer slice ends at **Meet Cove**. It uses the approved Cove avatar,
identity, runtime/model inventory, hierarchy, copy, semantic tokens, responsive
layout, and accessible HeroUI controls from the retained PRD-190 prototype. It
does not create or configure Cove, write a workspace, send a greeting, or enter
the onboarding Channel; those later transitions require their own durable
operations.
