import { createManualRecipe } from '../recipe.ts';
import type { ManualRecipeTopic } from '../types.ts';

export const playbookRecipes: readonly ManualRecipeTopic[] = [
    createManualRecipe({
        body: `
# Billing strictness loop

## When

Use this when money or entitlement changes are involved. Do **not** treat "checkout succeeded" as "the product should unlock" until you have traced every layer that grants the user-visible behavior. Billing work is strict because a false positive charges or blocks a real user.

## Steps

1. Name the user-visible claim first:
   > "I am verifying whether [account/workspace] should currently have [paid feature/limit/credit]."
2. Recover the latest product contract from the canonical owner/source. If contract wording is drift-prone, cite the exact source you checked and mark it current-at-time.
3. Map the full state chain, usually:
   1. provider object (customer/subscription/invoice/payment intent)
   2. webhook/event projection
   3. local billing/subscription row
   4. entitlement/permission check used by the product surface
   5. the actual UI/API behavior the user sees
4. Verify each layer independently. Prefer provider sandbox/webhook replay for changes; never infer from local DB alone.
5. If a change can charge, refund, cancel, downgrade, email, or expose paid access, stage it and ask for a human fire/approval step (see \`technique/sent-zero\`).
6. Report in this shape:
   > "Provider says X; local projection says Y; entitlement code reads Z; live surface shows W. Therefore [decision]. Residual risk: [one line or none]."

## Failure modes

- **Single-layer truth**: "Stripe says paid" or "DB says pro" is treated as final. Counter: require the full chain through the actual entitlement surface.
- **Stale product contract**: an old pricing rule is applied confidently. Counter: re-check the canonical contract/source before answering.
- **Webhook blind spot**: provider state changed but local projection did not. Counter: inspect event delivery/replay state before changing user access manually.
- **Silent irreversible action**: agent refunds/cancels/charges directly. Counter: stage and get explicit human fire unless a written delegation says otherwise.

## Proof it works

Vivian-side interview synthesis identified billing as the strongest strict-loop case: checkout, subscription, invoice, webhook projection, and local entitlement can all diverge. The same strict chain prevented stale pricing/access claims from being reported as canonical.`,
        class: 'playbook',
        industries: ['SaaS, marketplaces, paid communities'],
        prereqs: ['provider dashboard or sandbox', 'app DB/read access', 'product contract source'],
        related: [
            'decision/stake-strictness',
            'technique/sent-zero',
            'technique/acceptance-surface',
            'archetype/operator',
        ],
        slug: 'billing-strictness',
        summary:
            'Trace billing and entitlement state through every layer before asserting user-visible access.',
        tier: 'query',
        title: 'Billing strictness loop',
        triggers: [
            'the work touches payments, billing, subscriptions, credits, or invoices',
            'owner asks whether a paid/free/pro entitlement is correct',
            'user says they paid but the product does not unlock',
        ],
    }),
    createManualRecipe({
        body: `
## When

The owner ships written or visual content publicly and wants agents running the line while they keep taste and final say. Team size scales with stakes: one agent + owner review is a valid minimum; the full shape below is for content that must not ship wrong.

## The shape (agents × patterns)

- **Writer** (archetype/writer): drafts section-by-section in the owner's voice; owner filters keep/cut/defer; every checkpoint delivered as a versioned attachment.
- **Gates** (pattern/gate-chain): each gate one lens, held by someone who didn't write it — factual/technical fidelity; mechanical style rules (grep-checkable: banned punctuation, banned phrases); voice/register; visual spec if images exist. Producer never self-certifies.
- **Designer** (archetype/designer) if visuals: content owner decides what idea the image expresses *before* visual craft starts; a content-eyes review of the image is its own gate (visual clichés are grep-invisible).
- **Owner**: sets direction, filters drafts, holds the publish click (technique/sent-zero applies to the publish step).

## Minimum viable version (solo agent)

1. Study the owner's existing writing before drafting anything; write a voice-rules note they confirm.
2. Draft → deliver as attachment → owner comments (attachment comments / video review) → revise.
3. Self-run the mechanical gate as a literal checklist (grep for banned patterns — never from memory).
4. Stage the publish; owner fires.

## Failure modes

- **Voice drift**: agent slides toward generic register. Counter: voice-rules file is versioned and re-checked per piece; owner corrections get written back into it same-day.
- **Gate collapse**: one reviewer "checks everything" → producer blindness returns. Counter: one lens per gate; name the lenses when the chain forms.
- **Verify against the draft, not the surface**: checks run on the working copy while the published render differs. Counter: final gates run against the deployed/rendered artifact, byte-for-byte.
- **Feedback lost in chat**: owner's comments scattered across messages. Counter: comments live on the artifact (anchored), revisions come back as the next numbered version.

## Proof it works

This server's blog line runs this exact shape (writer + 3 gates + owner), most recently shipping a long-form post where the gate chain caught a factual slip, banned punctuation, a visual cliché, and a metadata spec risk — each by a different lens.`,
        class: 'playbook',
        industries: [
            'content/marketing origin; the gate structure generalizes to any shipped artifact',
        ],
        prereqs: ['attachment upload; at least 1 agent; more agents per gate as stakes rise'],
        related: [
            'archetype/writer',
            'archetype/verify-gate',
            'archetype/designer',
            'pattern/gate-chain',
            'technique/video-review',
            'technique/sent-zero',
        ],
        slug: 'content-pipeline',
        summary:
            'Run public content through voice, independent gate, owner-approval, and live-surface checks.',
        tier: 'query',
        title: 'Content production line (drafts → gates → publish)',
        triggers: [
            'owner wants a content pipeline (blog/social/docs) run by agents',
            'owner writes a lot and wants drafting + review help without losing their voice',
            'owner published something with errors and wants that to never happen again',
        ],
    }),
];
