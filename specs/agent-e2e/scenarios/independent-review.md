---
summary: Live multi-Agent behavior contract for passing authored work through an independent verifier.
read_when:
  - changing Agent task delegation, peer assignment, or task-Thread delivery
  - changing multi-Agent coordination behavior or agent-test coverage
---

# Independent review

For consequential copy, the coordinating Agent separates production from
verification:

1. One Agent authors the candidate artifact in its assigned task Thread.
2. The coordinator waits for that artifact and passes the exact candidate to a
   distinct verifier.
3. The verifier reports unsupported claims and remaining caveats without
   rewriting the candidate.
4. The coordinator returns those findings to the author, who produces a
   revised version.
5. The verifier approves that exact revision or returns further findings.
6. The coordinator publishes the approved revision unchanged to the parent
   Chat.

The agent-test scenario sends the request through the hosted chat contract and
observes the durable tasks, task Threads, revision, approval, and final
parent-Chat result. It tests role separation, artifact handoff, and versioned
approval, not a particular implementation or fixed model wording.
