---
summary: Managed Chrome supervision and Browser host-tool execution.
read_when:
  - changing Browser settings, supervision, profiles, or agent-browser forwarding
---

# Browser

Browser is a first-party host tool, not an external integration or MCP server.
Each Haus Computer attachment supervises one visible Chrome instance with a
durable named profile under that attachment's `browser/profiles` directory.
Profiles and processes never cross Server attachments. Agents assigned to the
same Computer use that Computer's Browser profile and signed-in accounts; the
Browser is not selected per Agent.

The implementation lives under `apps/computer/src/browser/`. It detects Chrome,
owns the launch contract, adopts only matching managed processes, serializes
commands through one FIFO, and exposes settings, Open, and Restart through the
typed Computer attachment protocol. Failures degrade Browser without blocking
Computer startup.

Browser configuration has two independent concerns. `profileName` selects the
durable Chrome user-data directory under the attachment; it is the browser
identity whose cookies and signed-in accounts Agents on that Computer share.
`enabled` is the desired supervision state: turning it on starts managed Chrome,
and turning it off stops supervision and closes the managed browser without
deleting the profile. Haus supplies the launch contract and fixed flags; the
profile name does not install Chrome or create a Google account.
The first setup dialog preselects Browser enabled, so saving the default profile
can immediately move the row into its observed lifecycle state; operators can
turn it off before saving if they only want to persist the profile first.

The Computer detects supported Google Chrome installations when it answers the
live `browser.get` request. The response's `application` contains the detected
path and version, or `null` when supported Chrome was not found. This is not part
of `ComputerInventory`: inventory is the periodic runtime and Cloud Agent
report, while Chrome discovery and browser process health are attachment-local
and volatile. `configured` means that Browser settings have been saved at least
once; it does not mean Chrome is running. `status` is the fresh observation for
the matching managed profile, and `healthy` is the only state that renders the
green `Ready` badge.

The Computer detail therefore presents these states separately: unavailable
when the Computer cannot answer or Chrome is not detected; available but not
configured with a `Configure` action; saved but off with an ellipsis menu; and
configured plus healthy with a green `Ready` badge and the same ellipsis menu.
Starting, recovering, stopped, or unhealthy process states keep their own
status badge rather than claiming readiness.

The App always calls authenticated Server tRPC. The Server verifies current
Server membership plus Owner or Admin authority, verifies the selected Computer
belongs to that Server, and relays the operation to that Computer's outbound
socket. The Computer detail is the Browser settings surface, so every request
has an explicit Computer target. Browser has no separate settings navigation
page; its former URL redirects to Computers. The browser never connects to a
Computer directly.

Enabling Browser starts supervision for that attachment. Disabling it stops
supervision, closes the managed browser, and may interrupt Agents using it,
without deleting the profile. Browser availability is attachment-level rather
than a per-tool Agent grant.
