# Tool Access

Tavern does not expose interactive tool approval prompts.

Tool access is governed by tool source, sandbox mode, and approval policy:

- harness-native tools come from the selected executor
- host tools require explicit per-agent grants
- MCP tools require an exact `(agent, connection, upstream tool name)` grant
  that Runtime rechecks immediately before the call
- sandbox mode controls the execution environment
- exposed tools are auto-approved unless Runtime adds a narrower approval policy

Tool discovery does not grant access. New upstream MCP tools remain ungranted.
Credentials stay at the Runtime-to-MCP-server boundary and never enter prompts
or tool arguments.

The first sandbox mode is `none`, a trusted local workspace. It is not a
security boundary.

Future sandbox modes can add Docker or Podman when Runtime has tested providers.
