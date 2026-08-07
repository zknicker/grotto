---
summary: Default triage label vocabulary for agent-skill work in Linear.
read_when:
  - using the triage skill in this repo
  - configuring Linear labels for Grotto agent-skill workflows
---

# Triage labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the label
strings used in Linear.

| Label in mattpocock/skills | Label in Linear | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate this issue |
| `needs-info` | `needs-info` | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for an AFK agent |
| `ready-for-human` | `ready-for-human` | Requires human implementation |
| `wontfix` | `wontfix` | Will not be actioned |

When a skill mentions a role such as "apply the AFK-ready triage label," use the corresponding
Linear label string from this table.
