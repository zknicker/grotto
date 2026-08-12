---
summary: Internals index for Server, App, Computer, data, React, and presentation architecture.
read_when:
  - changing Grotto architecture, ownership boundaries, or implementation layout
  - looking for Server, App, Computer, data, or frontend internals
---

# Internals

| Topic | Doc |
| --- | --- |
| System ownership | [Architecture Overview](architecture-overview.md) |
| Hosted collaboration | [Grotto Server](grotto-server.md) |
| App data flow | [Grotto App](app.md) |
| PostgreSQL model | [Data Model](data-model.md) |
| React conventions | [React Conventions](react.md) |
| Browser control | [Browser](browser.md) |
| Artifacts | [Artifacts](artifacts.md) |
| Widgets | [Widgets](widgets.md) |

Computer's execution ownership is defined by
[ADR 0019](../adr/0019-servers-own-collaboration-computers-own-execution.md); its current
implementation lives under `apps/computer/src/`.
