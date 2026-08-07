import { createManualRecipe } from '../recipe.ts';
import type { ManualRecipeTopic } from '../types.ts';

export const techniqueRecipesB: readonly ManualRecipeTopic[] = [
    createManualRecipe({
        body: `
# Owner wants proof without watching - send a receipt tied to the acceptance surface

### Trigger
Use this when "done" is not enough: the owner/reviewer needs to trust a posted artifact, rendered preview, data materialization, sent/unsent state, video capture, QA pass, or other acceptance surface without watching you do it. In software work, the same pattern can cover a run, deploy, or test suite.

### Use When / Don't Use When
Use receipts for high-stakes or replayable work. Do not bury routine low-stakes work in heavy receipts; for cheap reversible work, a short status and link are enough.

### Do This
1. Name the acceptance surface first: artifact, rendered page, live UI, dashboard, recipient/sent count, data row, preview URL, video file, or the owner-facing output. In software work, this can include a deployed page, production DB row, or test suite.
2. Capture the smallest proof that lets someone audit: screenshot, URL, attachment id, counts, sample output, command, checksum, manifest, or commit when code changed.
3. State scope: what the receipt proves and what it does not prove.
4. Separate verified from inferred. If a number is sampled, say sampled.
5. Redact private data and credentials before uploading receipts.
6. Put the receipt in the task thread and reference it in the handoff.

### Verify
The reviewer should be able to open or rerun the receipt path and confirm the exact claim. If the receipt proves a proxy but the claim is about a live surface, add the live-surface check.

### If It Fails
- **Proxy receipt**: internal checks passed but the real surface failed. Counter: tie receipt to the acceptance surface.
- **Unscoped receipt**: reviewer thinks it proves more than it does. Counter: include "proves / does not prove."
- **Private data leak**: raw rows or tokens get uploaded. Counter: sanitize and keep private samples local.
- **Receipt without handoff**: proof exists but nobody knows what to do next. Counter: pair with next action.

### Proof it works
Operational materializations, feature previews, and screen-recording QA runs use receipts with counts, commands, screenshots, artifacts, or checksums so reviewers can audit claims without watching the run.`,
        class: 'technique',
        industries: ['universal'],
        prereqs: ['acceptance surface', 'captured evidence'],
        related: [
            'technique/acceptance-surface',
            'pattern/evidence-handoff',
            'decision/stake-strictness',
        ],
        slug: 'proof-of-work-receipts',
        summary:
            'Tie a compact, scoped, sanitized proof receipt to the surface the owner actually needs to trust.',
        tier: 'query',
        title: 'Owner wants proof without watching - send a receipt tied to the acceptance surface',
        triggers: [
            'owner wants to trust work happened without watching',
            'need to prove a run, deploy, send, scan, or review completed',
            'handoff needs command outputs or artifact ids',
            'claim is important enough to audit later',
        ],
    }),
    createManualRecipe({
        body: `
# Need future follow-up — schedule a visible reminder instead of waiting in-process

### When
Use this when progress depends on future state: a human decision, CI finishing, a preview review, a data drop, or a scheduled daily/weekly routine. If the wait is longer than a short interactive pause, do not keep the current process alive just to poll.

### The rule
Schedule a Grotto reminder anchored to the relevant message or thread. A reminder is visible, owned by the author, snoozable, updateable, and wakes the right agent later. Memory is not a wake-up mechanism; it helps you resume after the reminder fires.

### Steps
1. Pick the anchor: task message or active thread, not a random channel root.
2. Write the reminder in action language: "check if the client replied" or "check CI and update task", not "remember this."
3. Choose the earliest useful time, not the optimistic time. If the state may still be pending, plan to snooze.
4. When it fires, read the anchor context before acting; then either complete the follow-up, snooze, update, or cancel.
5. If another person needs to know later, schedule your own reminder and mention them when it fires. Do not rely on a reminder to wake someone else unless it is their reminder.

### Failure modes
- **Sleeping in the current turn**: wastes runtime and still dies on restart. Counter: use a reminder for waits beyond about a minute.
- **Reminder without anchor**: future self wakes with no context. Counter: anchor to the message/thread that defines the work.
- **Memory as alarm clock**: memory persists facts, but never wakes you. Counter: reminder wakes; memory resumes.
- **Stale reminder**: context changes but the reminder text does not. Counter: snooze/update rather than stacking duplicate reminders.

### Proof it works
Daily work-reflection, data-pack checks, and one-time operational follow-ups all use visible Grotto reminders; when they fire, the agent resumes from the anchored thread instead of relying on an always-running process.`,
        class: 'technique',
        industries: ['universal'],
        prereqs: ['message or thread anchor'],
        related: ['decision/when-to-ask-human', 'pattern/evidence-handoff'],
        slug: 'reminder-cron',
        summary:
            'Schedule visible, author-owned reminders for future state instead of holding a process open.',
        tier: 'seeded',
        title: 'Need future follow-up — schedule a visible reminder instead of waiting in-process',
        triggers: [
            'follow up later if something has not happened',
            'wake me tomorrow or after review',
            'I need to check this thread again',
            "don't keep the agent running just to wait",
        ],
    }),
    createManualRecipe({
        body: `
# sent=0 — stage external actions fully, let the human fire

## When

Any action whose effect leaves the workspace: an email to a customer, a public post, a payment, a production deploy. The cost asymmetry rules: a mistake inside the workspace is cheap to fix; outside, it may be unfixable. The answer is not "don't automate" — it's **automate everything except the final click**.

## Steps

1. Do 100% of the work: research, draft, personalize, format, address. Materialize the complete, ready-to-fire artifact.
2. Store it in a state the owner can inspect exactly as it will fire (rendered email at sent=0, scheduled post in draft, staged deploy behind a flag).
3. Post the owner one review handle: what's staged, where to look, what one action fires it.
4. The owner fires it (or edits first). You never fire it yourself — even when confident, even when they seem busy. If they've explicitly delegated a class of sends, that delegation should be written somewhere you can cite.
5. After firing: verify the real result on the real surface (delivered email, live post), not just the tool's return code.

## Failure modes

- **"Staged" that isn't final**: owner approves a summary, the actual send differs (old copy, wrong recipient list). Counter: what the owner reviews must be byte-identical to what fires.
- **Approval fatigue**: dozens of stagings a day → owner rubber-stamps. Counter: batch stagings; put risk-relevant diffs at top; keep counts low enough that attention is real.
- **Silent queue death**: staged work waits forever because the owner missed the handle. Counter: anchor a reminder on the staging message; nudge once at an agreed interval.

## Proof it works

The outreach pipeline on this server has run months of daily sends on this exact contract (materialize → sent=0 → owner clicks), including a full email journey launch; zero unapproved external sends.`,
        class: 'technique',
        industries: ['universal (origin: outreach/email; applies to social, deploys, payments)'],
        prereqs: [],
        related: [
            'decision/stake-strictness',
            'decision/when-to-ask-human',
            'technique/proof-of-work-receipts',
        ],
        slug: 'sent-zero',
        summary:
            'Stage external actions completely at sent=0 and let the human approve the exact final effect.',
        tier: 'seeded',
        title: 'sent=0 — stage external actions fully, let the human fire',
        triggers: [
            'task ends in an external send (email, post, publish, payment, deploy)',
            'owner wants automation but is nervous about what goes out',
            'I am about to do something visible outside the workspace',
        ],
    }),
    createManualRecipe({
        body: `
# Before doing work, claim the task — the claim is the concurrency lock

### When
Use this whenever fulfilling a request requires action beyond just replying: running tools, editing code, inspecting attachments, creating docs, reviewing PRs, or operating a service. If it is work, claim first.

### The rule
The task claim is the concurrency lock. If a message is already a task, claim the task number. If it is a regular top-level work request, claim by message id. If the claim fails, do not work unless an owner/admin explicitly redirects it to you.

### Steps
1. Identify the canonical work item: existing task number or message id beats a new duplicate task.
2. Claim before the first tool call or implementation step.
3. Post progress in the task thread, not scattered across channels.
4. If ownership changes, unclaim or let the new owner reclaim before they start.
5. When implementation is ready for human validation, move status to \`in_review\`; mark \`done\` only after approval or explicit acceptance.

### Failure modes
- **Starting before claim**: duplicate work and conflicting patches. Counter: claim first, then work.
- **Create-instead-of-claim on triage**: two responders see the same existing request and each creates a task, minting duplicate work items because creation has no collision lock. Counter: if the work already exists as a top-level message, always claim by message id; use task creation only when no canonical request message exists yet.
- **Creating duplicate tasks**: parallel task objects split context. Counter: reuse the existing task/message when one exists.
- **Ignoring claim failure**: someone else owns the lock. Counter: stop unless redirected.
- **Done without review**: human never validates behavior. Counter: implementation goes to \`in_review\`; approval moves it to done.

### Proof it works
The same branch had a visible ownership change: one agent unclaimed two onboarding tasks, another claimed them before implementation, pushed a commit, then moved both tasks to review. That avoided duplicate implementation while preserving the thread history.`,
        class: 'technique',
        industries: ['universal'],
        prereqs: ['task board or message id'],
        related: ['pattern/discuss-then-assign', 'pattern/evidence-handoff'],
        slug: 'task-claim-lock',
        summary:
            'Claim the canonical task or message before the first tool call to prevent duplicate work.',
        tier: 'seeded',
        title: 'Before doing work, claim the task — the claim is the concurrency lock',
        triggers: [
            'should I claim this before starting',
            'two agents might work on the same request',
            'someone assigned this task to me',
            'a message asks me to run tools or make changes',
        ],
    }),
    createManualRecipe({
        body: `
# Async review via recorded walkthrough + timestamped comments

## When

Your deliverable is visual or interactive (a UI, a document render, a video, a flow) and the owner's feedback needs to point at *places* in it. Live sessions cost the owner synchronous time; text descriptions cost precision. This converts review into a fully async artifact.

## Steps

1. Deliver your work with a viewable surface (preview URL, rendered attachment, video file).
2. Ask the owner to review by recording:
   > "If it's easier, screen-record a walkthrough and drop it here — leave comments with timestamps and I'll fix everything without needing you live."
3. Owner records once, drops the video in the channel, adds timestamped comments (or timestamps in one message).
4. Read every timestamp; for each: locate the moment, extract the issue, fix it. Track as a checklist in the thread.
5. Post one consolidated "all N addressed" reply mapping timestamp → change. Owner verifies on return.

For document/HTML artifacts the same loop runs through **attachment comments** (quote + region anchors reach you directly — see related card).

## Failure modes

- **Comments without timestamps**: you must watch the whole video to locate each issue — the annotation is what makes this cheap. Counter: ask for timestamps explicitly in step 2.
- **Replying per-comment**: N fixes = N messages floods the owner. Counter: one consolidated reply, per the owner-attention rule.
- **Fixing what you inferred, not what they marked**: timestamps are the contract; if a fix requires reinterpreting their intent, ask on that timestamp only.

## Proof it works

This is the owner-side review mechanic used across this server's video production and design lanes; the pattern-level write-up (roles + why it beats screenshot ping-pong) is pattern/video-review-loop.`,
        class: 'technique',
        industries: ['universal (strongest for UI/design/video/docs deliverables)'],
        prereqs: ['attachment upload; owner can screen-record'],
        related: [
            'technique/attachment-comments',
            'pattern/video-review-loop',
            'technique/preview-env',
        ],
        slug: 'video-review',
        summary:
            'Use a recorded walkthrough and timestamped comments for precise asynchronous review.',
        tier: 'seeded',
        title: 'Async review via recorded walkthrough + timestamped comments',
        triggers: [
            'owner wants to review my output without a live session',
            'owner keeps sending screenshots describing where problems are',
            'review feedback loses precision in text (which button? which screen?)',
        ],
    }),
];
