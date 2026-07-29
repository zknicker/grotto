---
summary: Managed Chrome supervision and Browser host-tool execution.
read_when:
  - changing Browser settings, supervision, profiles, or agent-browser forwarding
---

# Browser

Browser is a first-party host tool, not an external integration or MCP server.
Each Grotto Computer attachment supervises one visible Chrome instance with a
durable named profile under that attachment's `browser/profiles` directory.
Profiles and processes never cross Server attachments.

The implementation lives under `apps/computer/src/browser/`. It detects Chrome,
owns the launch contract, adopts only matching managed processes, serializes
commands through one FIFO, and exposes settings, Open, and Restart through the
typed Computer attachment protocol. Failures degrade Browser without blocking
Computer startup.

The App always calls authenticated Server tRPC. The Server verifies current
Server membership plus Owner or Admin authority, verifies the selected Computer
belongs to that Server, and relays the operation to that Computer's outbound
socket. The browser never connects to a Computer directly.

Enabling Browser starts supervision for that attachment. Disabling it stops
supervision without deleting the profile. Browser availability is
attachment-level rather than a per-tool Agent grant.
