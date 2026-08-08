---
summary: Mandatory fresh-Server setup through one durable Cove factory application.
read_when:
  - changing fresh-Server creation, first-Computer setup, the Server shell gate, or Cove onboarding UI
---

# Fresh-Server Onboarding

Every newly created Server begins in mandatory setup. Creation atomically keeps
the existing first Owner and `#all` guarantees while adding durable onboarding
progress and private `#onboarding-owner`, initially containing only that Owner.
No Computer, Agent, or execution configuration is created automatically.

The first step gives the Owner one Server-specific Grotto Computer
install-and-setup command. A Computer connection records live progress but does not
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

At **Meet Cove**, the Owner chooses only a usable runtime and model from the
pinned Computer's reported inventory. `server.createCove` is the one dedicated
creation operation; ordinary Agent creation cannot supply Cove's identity. One
Server transaction locks onboarding, fixes Cove's profile and Admin role,
stores the release-owned avatar through the normal avatar contract, binds Cove
immutably to the Computer, joins Cove to `#onboarding-owner`, reserves one
application id, and advances to `applying`. An identical retry returns that
reservation. A different Computer/runtime/model conflicts and cannot rebind it.

While applying, reconnect sends only the explicit `cove-apply` factory command,
never ordinary Agent configuration or a model turn. Computer validates its
current runtime/model inventory, seeds the exact Cove workspace and normal
isolated skill library, writes a durable local receipt, then returns a matching
`cove-apply-result`. Command and acknowledgement replay are idempotent. Only an
`applied` result for the reserved Agent, application, and Computer advances the
Server to `complete`; effective-state reports and model messages do not.

The App collapses the internal pipeline at its presentation boundary. While
the durable phase is applying, the owner sees only a quiet “Getting Cove
ready…” state—never creation, configuration, workspace, factory, command, or
acknowledgement substeps. Failures become one plain retry or Computer-repair
sentence; raw codes and diagnostics remain internal. Completion invalidates
Server state and replaces the setup route with retained
`#onboarding-owner`. The same Server transaction creates one durable system
attention item for Cove in that Channel. The App unlocks immediately; the
attention item runs through ordinary Agent delivery and Cove authors the first
canonical message with Cove's identity. It is not a Server-authored greeting.
Restart and reconnect may replay the same run until settlement, but application
acknowledgement replay cannot create another attention item after onboarding is
complete. A failed turn leaves onboarding complete and uses the normal Agent
failure, Start, and repair controls.

Cove's product-owned identity and avatar cannot be edited through ordinary
Agent controls. Once onboarding is complete, Cove otherwise follows the normal
Agent lifecycle. An Owner or Admin may delete Cove through the confirmed Agent
flow without changing the durable onboarding record, relocking the App,
creating another onboarding Channel, or recreating Cove. A full reset restores
Cove's exact factory workspace; a session reset preserves its workspace and
skills.
