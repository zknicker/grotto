---
status: "superseded by ADR-0003"
summary: Decision to wire Grotto Widgets explicitly through host adapters instead of a registry framework.
read_when:
  - changing Widget folder shape, host adapters, registries, manifests, or plugin boundaries
---

# Widgets use explicit wiring

Grotto Widgets use explicit contracts, host adapters, tool calls, and generated agent guidance
instead of a centralized registry, manifest loader, plugin framework, or generic render DSL. Grotto
is one codebase, and this feature optimizes for simple agent-editable code over modularity that is
not needed yet.

Superseded by [Rich Responses use json-render specs](0003-rich-responses-use-json-render-specs.md).
