---
summary: Managed Chrome supervision and Browser host-tool execution.
read_when:
  - changing Browser settings, supervision, profiles, or agent-browser forwarding
---

# Browser

Browser is a first-party host tool, not an external integration or MCP server.
Runtime supervises one visible Chrome instance with a durable named profile
under `~/.tavern/browser/profiles`.

The implementation lives under `apps/runtime/src/browser/`. It detects Chrome,
owns the launch contract, adopts only matching managed processes, serializes
commands through one FIFO, and exposes Open and Restart through `/browser/*`.
Failures update the `browser` Runtime capability without blocking startup.

Browser access is an explicit per-agent host-tool grant. Enabling Browser
globally starts supervision; disabling it warns about affected agents and clears
their Browser grants. `web_fetch` is a separate host tool and remains granted by
default.

The generated Browser skill documents `agent-browser` vocabulary. The executable
AI SDK tool rechecks the grant before forwarding a command to the supervised
Chrome endpoint.
