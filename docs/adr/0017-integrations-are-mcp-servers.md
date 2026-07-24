---
summary: Decision to retire plugins in favor of operator-configured MCP servers granted per-agent, reached through a runtime credential-broker relay; host tools and model capabilities are the only non-MCP capability kinds.
read_when:
  - adding or changing how agents reach outside services (MCP servers, grants, the relay)
  - configuring credentials, OAuth, or per-agent access for an integration
  - deciding whether a capability is an MCP server, a host tool, or a model capability
  - changing the MCP settings surface, or deleting the retired plugin framework
---

# ADR 0017: Integrations Are MCP Servers

## Status

Accepted (2026-07-24, WS-MCP of the Raft-alignment program; decision D9 in
`specs/raft-alignment/README.md`). **Supersedes ADR 0004** (plugins as
settings-managed runtime capabilities) and the former "WS5.5 — Plugin CLIs"
plan.

## Context

Pre-flip, outside services reached agents as first-party **plugins**: manifest
bundles (MerchBase, Google, Browser) exposing engine tools, settings panels, and
secrets, per ADR 0004. The flip deleted the plugin engine tools (zero-engine-tool
ruling, D5) and left plugins dark. The open question was how they come back.

Plugins are off-model for a product meant to generalize beyond a single operator:
they bake specific first-party services into the app, and they are engine tools by
another name, which the flip exists to remove. The Raft model — verified this
session against Raft's docs and its onboarding agent (Cindy) — is that outside
services are reached as configured integrations or host tools, discovered and
invoked through the shell, never as a first-party catalog. Raft runs **zero**
registered integrations on its own server; its generic rail is aspirational, and
its credentials live on the computer where the agent runs, not on the central
Raft server.

A supporting survey (24 July 2026, first-party docs) of MCP-serving vendors —
Google Workspace and Google Cloud, Linear, GitHub, Notion, Sentry, Atlassian,
Stripe — found that literal OAuth `client_credentials` is rare (Linear only);
most services authenticate as a delegated **user**, with heterogeneous
machine-auth escape hatches (Google workload identity, GitHub App installation
tokens, service-account tokens, restricted keys). Personal Google accounts — the
common case for a single operator — have no owner-level machine path at all.

## Decision

The plugin concept is retired. Capabilities are exactly three kinds:

1. **MCP servers** — the way agents reach outside services. The operator
   registers a server and grants it to specific agents (same per-agent
   assignment model as skills). Grant equals existence: an ungranted agent has
   no access and no schema in context.
2. **Host tools** — local machinery that is not a service call, kept as-is.
   Browser is the only one (Chrome lifecycle, profiles, CDP). Raft treats its
   `agent-browser` the same way.
3. **Model capabilities** — provider-native abilities. Image generation is the
   only one (codex-native via managed CODEX_HOME); no CLI or tool wrapper.

### The runtime is the credential broker

Agents reach granted MCP servers through a **runtime-owned relay**:

- Agents authenticate to the relay with their existing per-agent Grotto token.
- The relay holds upstream credentials **in the runtime** — not on the grotto.sh
  server. Secrets live where agents execute (Raft parity). The server split
  (WS6) moves chat and identity; it never moves integration credentials and does
  not gate this work.
- The relay **terminates MCP and auth**; it is not a transparent proxy. The
  inbound Grotto token and the upstream credential have different audiences —
  MCP forbids token passthrough. The relay is an independent MCP client upstream.
- The relay authorizes **every tool-call** against `(agent, server, tool)` and
  fails closed. Grant-by-server is not enough on its own; tool-list omission is
  presentation, not access control.
- The relay never logs secrets (headers, OAuth codes, refresh tokens, raw
  arguments). Audit records the agent, server, tool, decision, and outcome.

OS-level isolation of one agent from another (they share a machine user) is an
operator **deployment** concern — run the runtime under a separate OS user for
hard isolation — documented, not built. Grotto does not sandbox agents from each
other, matching Raft.

### Per-server auth is per-integration

There is no single universal auth scheme:

- **Personal external accounts** (e.g. Google Calendar): the operator completes
  OAuth once at configuration time; the relay holds the session. Agents act as
  the owner. Correct for intrinsically personal resources.
- **First-party services** (MerchBase): the relay presents a Grotto-issued badge
  the agent cannot mint, so an agent cannot bypass the relay and call the service
  directly. Downstream per-agent machine identity (e.g. Clerk M2M
  machine-per-agent) is **not** built by default — the relay plus per-agent
  grants already provide custody, access control, and audit — and is added only
  per-service if independent revocation, rate limits, or native audit actors
  demand it.

There is **no `grotto integration` CLI family**, now or ever. The relay + grants
+ MCP standard are the governed path; host tools + skills are the escape hatch.

### First-party service code leaves Grotto

MerchBase logic moves to an MCP server in `merchbase-core`; the Grotto-side
MerchBase and Google plugin code is deleted. **Google is a configuration
example, not a shipped feature**: the acceptance test for the whole system is
that an operator can add Google Calendar as an MCP server, grant it, and have an
agent use it with zero first-party Google code. If that works, the plugin
replacement is real and MerchBase rides the same rails.

### Surface and reuse

- Keep the existing MCP substrate: `apps/runtime/src/agent-engine/mcp-servers.ts`,
  `mcp-routes.ts`, `mcp-server-routes.ts`.
- **UI ports, not rewrites**: lift the polished plugin settings cards, dialogs,
  and forms (`apps/website/src/features/settings/plugins/`) onto the existing MCP
  data layer (`apps/website/src/features/settings/mcp/`), then delete
  `settings/plugins/`.
- Delete the plugin host/manifest/settings framework
  (`apps/runtime/src/plugins/store.ts`, `routes.ts`, `agent-capabilities.ts`,
  `materialize-skills.ts`, `merchbase*`, `google*`; server `api/plugin/**`),
  rehoming Browser's health and grant wiring onto the MCP-grants surface.
- The `## MCP` prompt section composes only for agents with at least one granted
  server. Prompt-text changes follow the guarded-prompt-contract rules.

## Consequences

- One generalized system replaces a first-party catalog: any operator adds any
  MCP server (their own, Google's hosted servers, community servers) without
  Grotto code changes. This is the point of retiring plugins.
- Context cost: MCP schemas ride the harness context. Mitigated by per-agent
  grants (fewest servers), per-server tool filters, and native deferral on
  claude-code and codex; pi gets lean grants (no native deferral).
- MerchBase gains an MCP server as new surface in `merchbase-core` (small; the
  read actions it already exposes), which puts one leg of the release-blocking
  path outside this repo.
- External MCP-client exposure (Claude.ai/ChatGPT reaching first-party services
  as an OAuth resource server) is **deferred** — not needed to validate the
  local relay, additive later with no rework, and it would pull public ingress
  and WS6-shaped infrastructure into a release meant to stay small.

## Alternatives rejected

- **A `grotto integration` CLI rail** (Raft's `integration login/env/invoke`
  analog): every property it offers is already assigned to the relay, grants,
  Clerk (human auth), and the MCP standard. Raft needs a proprietary rail because
  it is its own identity root with a bespoke manifest; we chose the MCP standard.
  Even Raft runs zero registered integrations on its own server.
- **Per-service first-party CLIs** (the WS5.5 plan): re-creates the
  build-and-teach-an-interface-per-service cost that MCP moves into the service
  (or deletes, for vendors like Google that host their own MCP servers).
- **Clerk M2M machine-per-agent as the default internal auth**: redundant with
  the relay for a single operator; kept available per-service only where
  independent revocation genuinely matters.
- **Credentials on the grotto.sh server**: rejected for operator trust and Raft
  parity — secrets live on the computer where agents run.
