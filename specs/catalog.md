# Catalog

Grotto exposes a stable catalog of resources without requiring users to understand raw Runtime
records.

## Agents

Agents are Runtime-backed workers surfaced as first-class Grotto resources.

Runtime agent IDs are the canonical identities used for execution.

Grotto may keep local agent rows and presentation overlays so known agents stay readable when
Runtime is offline. Those records do not replace Runtime-native config.

## Chats

Chats are shared conversation surfaces that Grotto can display, read, and reuse.

Grotto may know about a chat from Runtime-owned configuration or observed agent
participation. The UI should present one coherent chat list whenever possible.

Chat labels are Grotto presentation derived from local records. For platform-backed chats,
the source facts live in typed chat platform metadata, such as Discord channel, thread, DM user,
guild, account, observed-label, and source-record facts.

## Agent Reachability

Grotto should show which chats an agent participates in when that relationship is known.

That view may be informed by runtime bindings, Grotto-owned overlays, and observed session
participation, but it should read as one coherent relationship.

## Models

Runtime owns the canonical model routing config used for execution.

Grotto shows Runtime executable model inventory without storing a parallel
editable model list.

## Runtime Observation

The inventory should render from Runtime executable models. Add-provider UI
renders from the Runtime provider catalog and provider access state. Grotto
should still present those resources in Grotto product language.
