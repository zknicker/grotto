---
read_when:
  - reviewing the Agent E2E attention and cross-Chat delivery baseline
---

# Attention and cross-Chat delivery — 2026-07-30

Matched business interactions used GPT-5.6 Terra with medium reasoning. The
comparison Agent was Cindy. The Grotto Agent was Wren.

## Comparison baseline

Workspace: `arcade`

- Channel: `attention-e2e-0730`
- Evidence:
  `https://app.raft.build/s/arcade/channel/a3989783-c55a-4797-9034-202b7ba29c93`
- DM: Cindy's already-materialized pairwise human-Agent DM

| Behavior | Prompt | Observed outcome |
| --- | --- | --- |
| Addressed Agent only | `@Cindy Please record that Maya owns the Bluebird launch. Reply only: Owner noted: Maya.` | Cindy replied exactly once with `Owner noted: Maya.` Bob received the delivery but sent nothing. |
| Channel no-response FYI | `@Cindy FYI only, no response needed: Maya accepted the Bluebird launch owner role.` | No Agent message after 20 seconds. |
| DM no-response FYI | `FYI only, no response needed: Maya accepted the Bluebird launch owner role.` | No Agent message after 20 seconds. |
| Concise ordinary DM | `Quick status check: reply only with BLUEBIRD-READY.` | Cindy replied exactly `BLUEBIRD-READY`. |
| Two-Chat delivery | DM `Reply only with MULTI-DM-0730.` followed immediately by Channel `@Cindy Reply here only with MULTI-CHANNEL-0730.` | Cindy placed each exact reply in its requested Chat. |
| Cross-Chat context | DM `For the Bluebird launch, remember that the deployment codename is KESTREL-ATTN-0730. Confirm briefly.` followed by Channel `@Cindy Without tools or files, what Bluebird deployment codename did I just give you in DM? Reply only with it.` | Cindy recalled `KESTREL-ATTN-0730` in the Channel. |
| Mid-turn freshness | `@Cindy Compare Linear and Asana for a 25-person product team using current official pricing and permissions docs, then recommend one. Before answering, verify both vendors.` followed while Cindy was searching by `Additional Bluebird constraint: the recommendation must support SAML SSO below $400 per month for 25 seats. Incorporate this in your recommendation.` | Cindy's acknowledgement and settled recommendation both incorporated the late SAML and price constraint. |

These are product observations, not implementation assertions.

## Grotto result

Fresh isolated stack identity: `agent-e2e`

Command:

```sh
GROTTO_DEV_STACK_ID=agent-e2e bun run eval:agents
```

Result: all seven browser-driven attention and resident-delivery scenarios
passed. The first five completed together in 1.8 minutes; D3 and D7 then
passed focused runs in 43 seconds and 33 seconds.

The suite:

1. sends through the visible App composer;
2. observes the reply or silence in the live App;
3. verifies the same outcome in canonical Server history;
4. uses Wren's configured GPT-5.6 Terra model.

Executable coverage:

- D1 addressed delivery
- D2 two-Chat target separation
- D3 mid-turn freshness
- D7 cross-Chat continuity
- A1 intended Agent only
- A2 Channel silence
- A3 DM silence
- A4 concise ordinary DM

The first D7 run exposed an over-specific test assertion: the visible reply was
`Confirmed — <codename>`, while the test required the codename to be the whole
text node. The product contract permits a brief confirmation, so the executable
scenario checks that the fact is visible before making the exact recall probe.

The durable A4 gate now asks a small factual question and requires one brief,
correct reply. The comparison product's exact-token prompt remains baseline
evidence, but Grotto no longer passes A4 merely by obeying forced reply copy.
The A1 gate also observes a bounded quiet period for the unaddressed Agent
before declaring recipient isolation.
