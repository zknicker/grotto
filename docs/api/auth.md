---
summary: Authentication boundaries for humans, Computer attachments, managed Agents, and providers.
read_when:
  - changing Clerk identity, Server authorization, Computer credentials, or Agent runner access
  - changing secret custody or provider-session behavior
---

# Auth

| Boundary | Credential and authority |
| --- | --- |
| Human App → Server | Clerk-authenticated User plus Server membership and role checks |
| Computer management → Server | Machine-local Computer login session; setup authority only |
| Computer attachment → Server | Revocable credential scoped to one Server Computer |
| Computer runner → Server | Per-launch Agent runner credential, held behind the localhost proxy |
| Managed Agent → Computer | Per-launch local proxy token file; never valid at Server |
| Computer → provider | Native Codex, Claude Code, or Pi login owned by that runtime |

Server stores Computer, runner, MCP, and hosted OAuth secrets. Computer stores attachment
credentials and local proxy tokens in private files. Grotto does not accept, copy, or relay model
provider credentials: operators authenticate through each execution runtime's native flow.

Do not place secrets in Messages, prompts, logs, execution reports, e2e fixtures, checked-in env
files, or App cache. Every Server route rechecks the authority required by its product operation.
