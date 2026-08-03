---
summary: Live multi-Agent behavior contract for passing authored work through an independent verifier.
read_when:
  - changing Agent task delegation, peer assignment, or task-Thread delivery
  - changing multi-Agent coordination behavior or live Agent E2E coverage
---

# Independent review

For consequential copy, the coordinating Agent separates production from
verification:

1. One Agent authors the candidate artifact in its assigned task Thread.
2. The coordinator waits for that artifact and passes the exact candidate to a
   distinct verifier.
3. The verifier identifies claims unsupported by the supplied evidence and
   returns corrected copy plus any remaining caveat.
4. The coordinator publishes the reviewed version and caveat to the parent
   Chat.

The live Agent E2E scenario drives the request through the App composer and
observes the durable tasks, task Threads, and final parent-Chat result. It tests
role separation and artifact handoff, not a particular implementation or fixed
model wording.
