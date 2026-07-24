---
summary: SUPERSEDED by ADR 0017 — plugins are retired in favor of operator-configured MCP servers. Historical record of the plugin capability model.
read_when:
  - understanding the retired plugin framework being deleted in WS-MCP
  - reading history behind ADR 0017 (integrations are MCP servers)
---

# Plugins are settings-managed Runtime capabilities

> **Superseded by [ADR 0017](0017-integrations-are-mcp-servers.md)** (2026-07-24,
> WS-MCP; decision D9). The plugin concept is retired: outside services now reach
> agents as operator-configured MCP servers granted per-agent, with credentials
> held by a runtime broker. Browser survives as a host tool; image generation as
> a model capability. The framework this ADR describes is being deleted. The text
> below is kept as the historical record of what plugins were.

Tavern Plugins are built-in, manifest-declared capability bundles configured
and repaired through Tavern settings. Agents may read Plugin health and use
read-oriented Plugin actions through named Runtime tools only when Runtime
reports the capability usable. Sync, repair, ingestion control, ripcord, account
selection, secrets, and enablement stay user-managed settings or app controls
rather than agent tools. Future agent-assisted setup must run through a
Tavern-wide settings flow, not a Plugin-specific shortcut.

The Plugin manifest declares inventory and ownership metadata such as id, name,
version, settings, secrets, Plugin-level health capabilities, Services, and Widgets. Every Plugin declares at least one Service. Services own
their health capabilities, skills, and tool groups. In v1, the manifest does not
declare dynamic executable wiring or enumerate Plugin-internal read operations;
Runtime and App import first-party Plugin modules directly.

Core Tavern owns the Plugin host boundary: lifecycle, enablement, Service
enablement, grants, health registration, capability projection, the Plugins
settings frame, and first-party registration. The Plugin folder owns its
domain-specific runtime reads, tool implementations, settings panel content,
validation copy, component rendering behavior, and helper APIs used by its own
components. This keeps MerchBase-specific concepts inside the MerchBase Plugin
instead of spreading operation names through generic Tavern docs.

Plugins are the normal product direction for integrations. Raw MCP servers may
exist as Runtime plumbing or an advanced development surface, but v1 does not
ask users to install arbitrary tool packages or configure raw MCP servers as the
primary way to extend agents.

Plugin settings and secrets use dedicated Runtime Plugin tables. They do not
live in generic runtime metadata, skill files, CLI config, or
environment variables. Runtime capabilities store current Plugin health
separately from the durable settings and secrets.

Plugin enablement, Service enablement, and agent-level Plugin grants are the
source of truth for Plugin-provided agent capabilities. Users enable or disable
the Plugin itself from Settings -> Plugins, enable the desired Services inside
that Plugin, then grant the Plugin to agents from agent capability settings.
Tavern does not expose individual Plugin tool toggles.

Runtime materializes Plugin-owned skills, tools, and Widget authoring
guidance for an agent turn only when the Plugin is globally enabled, the Service
is enabled, required connection scopes are granted, and the Plugin is granted to
that agent. Health remains diagnostic so transient upstream failures do not make
agent tools appear and disappear during a turn. Historical chat rows with
compiled Plugin-owned Widgets continue to render after a grant
is removed. If the Plugin is globally disabled, Plugin-backed interaction
controls inside historical renders are disabled; Tavern does not use fallback
data sources for live re-query.

The storage shape is Plugin-owned:

```sql
runtime_plugins(
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

runtime_plugin_secrets(
  plugin_id TEXT PRIMARY KEY,
  secret_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

For MerchBase, `runtime_plugins.config_json` stores non-secret settings such as
base URL, default account, and default marketplace.
`runtime_plugin_secrets.secret_json` stores the API key. Plugin list reads mask
secrets, while settings detail reads can return secrets to the local owner so
the settings UI can reveal saved values. Plugin-backed Widgets, the managed
`merchbase` Runtime tools, and settings routes go through the Runtime Plugin
service rather than reading these tables directly. The managed `merchbase`
skill is instruction-only: it describes when to use the tools and Widget, but
does not expose raw Runtime API calls as the agent contract.

For multi-Service Plugins such as Google, `runtime_plugins.config_json` stores
`services.<serviceId>.enabled`. OAuth tokens, granted scopes, expiry, and
account identity live in `runtime_plugin_secrets.secret_json`. The initial
Google Plugin ships Calendar as the first Service; Drive, Gmail, Docs, and other
Google Services can be added as manifest Services without changing the Plugin
storage tables.

Google's OAuth client id is Tavern-owned infrastructure config, not a Plugin
setting. Runtime reads the desktop client id and installed-app client secret from
environment supplied by Tavern development or release packaging and stores only
user OAuth tokens in Plugin secrets.
