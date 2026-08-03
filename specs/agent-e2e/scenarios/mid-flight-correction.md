---
summary: Live multi-Agent behavior contract for applying material owner corrections during coordinated work.
read_when:
  - changing Agent task delegation, busy delivery, freshness, or task-Thread behavior
  - changing multi-Agent coordination behavior or live Agent E2E coverage
---

# Mid-flight correction

When an owner materially changes the requirements during coordinated work, the
coordinator treats the correction as new authoritative context:

1. Independently owned lanes remain identifiable and active while initial work
   is in flight.
2. The owner sends the correction through the App composer.
3. The coordinator propagates the correction to every still-relevant active
   task Thread before accepting final lane findings.
4. Each lane revises its finding against the new hard requirements.
5. The coordinator withholds recommendations based only on the original
   criteria and publishes one synthesis that reflects the corrected constraint.

The live Agent E2E scenario compares two product candidates, then makes EU data
residency and complete standard-format export hard gates after both candidate
lanes have acknowledged and claimed their work. It proves durable propagation,
ordering, stale-recommendation suppression, and the final result through the
real App, Server, Computer, and model. It does not require fixed model prose
beyond explicit behavior markers and the owner-supplied decision constraints.
