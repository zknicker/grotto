/**
 * Seed-practice notes written into every new agent workspace (WS8, D7).
 *
 * The contents are TRANSCRIPTIONS of Raft's seeded-tier recipe cards
 * (specs/raft-alignment/raft-recipes/, tier: seeded), adapted near-verbatim:
 * raft CLI verbs become grotto verbs, Raft-team provenance ("Proof it works",
 * frontmatter, manual pointers) is dropped because a newborn Grotto agent has
 * no such history, and `login-with-raft` is excluded (no Grotto equivalent
 * until external agents, WS6 era). `save-as-a-skill.md` is the Grotto
 * addition absorbing the skill-capture habit dropped from the composed
 * prompt at the flip (ruling W2). Do not editorialize here; content changes
 * track the source cards.
 */

export interface StarterNote {
    content: string;
    /** File name under the target notes directory. */
    fileName: string;
    /** One-line index hook rendered into the starter MEMORY.md. */
    hook: string;
}

export const practiceNotes: StarterNote[] = [
    {
        fileName: 'task-claim-lock.md',
        hook: 'claim before you work — the claim is the concurrency lock',
        content: `# Before doing work, claim the task — the claim is the concurrency lock

Use this whenever fulfilling a request requires action beyond just replying: running tools, editing code, inspecting attachments, creating docs, reviewing PRs, or operating a service. If it is work, claim first.

## The rule

The task claim is the concurrency lock. If a message is already a task, claim the task number. If it is a regular top-level work request, claim by message id. If the claim fails, do not work unless an owner/admin explicitly redirects it to you.

## Steps

1. Identify the canonical work item: existing task number or message id beats a new duplicate task.
2. Claim before the first tool call or implementation step.
3. Post progress in the task thread, not scattered across channels.
4. If ownership changes, unclaim or let the new owner reclaim before they start.
5. When implementation is ready for human validation, move status to \`in_review\`; mark \`done\` only after approval or explicit acceptance.

## Failure modes

- **Starting before claim**: duplicate work and conflicting patches. Counter: claim first, then work.
- **Create-instead-of-claim on triage**: two responders see the same existing request and each creates a task, minting duplicate work items because creation has no collision lock. Counter: if the work already exists as a top-level message, always claim by message id; use task creation only when no canonical request message exists yet.
- **Creating duplicate tasks**: parallel task objects split context. Counter: reuse the existing task/message when one exists.
- **Ignoring claim failure**: someone else owns the lock. Counter: stop unless redirected.
- **Done without review**: human never validates behavior. Counter: implementation goes to \`in_review\`; approval moves it to done.

See also: notes/practices/discuss-then-assign.md, notes/practices/evidence-handoff.md
`,
    },
    {
        fileName: 'discuss-then-assign.md',
        hook: 'several agents could take it — claim before work, discuss before claim',
        content: `# Several agents could take this — claim before work, discuss before claim

A work item lands in a shared channel and more than one agent could plausibly take it. The failure you are preventing is two agents doing the same work — or zero agents, each assuming the other took it.

## Steps

1. **Claim is the lock.** Whoever will do the work claims the task object BEFORE starting. No claim, no work.
2. If ownership is ambiguous, a quick thread first: who has the lane, who has the firsthand evidence, who has capacity. Lane owner wins ties.
3. The non-taker exits with one line ("yours — I have X if you need it"), not silence: silence re-creates the ambiguity.
4. Claim scope = the message's scope. New work discovered mid-task is proposed as a new item, not silently absorbed.
5. Handovers transfer by observed delivery, not by promise: the old owner stands down after the new owner's first real output, not after "I've got it."

## Failure modes

- **Claim-after-start**: two half-done copies of the same work. Counter: the claim precedes the first tool call.
- **Discussion without claim**: everyone agrees someone should do it; nobody does. Counter: the discussion's last line is always a claim.
- **Silent scope creep**: the claimed task quietly grows past what anyone agreed. Counter: renegotiate additions in-thread.
- **Promise-based handover**: coverage gap between "I'll take it" and actual delivery. Counter: staged cancellation on observed output.

See also: notes/practices/task-claim-lock.md, notes/practices/one-or-many.md
`,
    },
    {
        fileName: 'stake-strictness.md',
        hook: 'stakes = irreversibility × audience × money; calibrate process to stakes',
        content: `# How careful should this task's loop be — calibrating process to stakes

You are deciding how heavy this task's loop should be: do-and-report, or staged with human sign-off. Use this before starting, not after something shipped.

## The rule

Stakes = **irreversibility × audience × money**. Three tiers:

1. **Low** (internal, cheaply reversible): do it, report after. Adding process here wastes the owner's leverage.
2. **Medium** (team-visible, reversible with effort): do it behind a draft or preview; owner approves before it takes effect.
3. **High** (external send, publish, changes to live systems, money): stage everything, keep send-count at zero until the owner approves the **exact final artifact**, then verify the exact bytes that shipped. Approval attaches to bytes, not to intentions.

## Steps

1. Classify the task's highest-stakes surface (not its average).
2. Say the tier out loud in the task thread ("this touches an external send, so I'll stage and hold").
3. For high stakes: build → stage → owner sees the final version → explicit yes → ship → verify the live artifact matches what was approved.

## Failure modes

- **Draft that auto-publishes**: treated as low-stakes because "it's a draft," but the surface ships on save. Counter: classify by where it CAN end up, not where it starts.
- **Approval version-skew**: owner said "looks good" to version N, version N+2 shipped. Counter: re-approve after any post-approval edit; approval names the version.
- **Verified preview, unverified prod**: checks ran on the staging copy only. Counter: post-ship byte check on the live surface.

See also: notes/practices/sent-zero.md, notes/practices/when-to-ask-human.md
`,
    },
    {
        fileName: 'when-to-ask-human.md',
        hook: 'proceed when reversible + in-lane + precedented; ask with one staged question',
        content: `# Proceed or check with the owner first — when to ask a human

Mid-task, you hit a decision you could make yourself — or maybe shouldn't. Use this to decide in seconds instead of stalling.

## The rule

**Proceed** when the action is reversible AND in your lane AND derivable from standing instructions or precedent. **Ask** when it is irreversible, out of your lane, or preference-shaped with no precedent (naming, tone, money, scope changes). **Never block silently**: do the reversible parts now, stage the blocked part, and ask one specific question.

## How to ask (the shape matters)

1. One question, not five.
2. Carry a default: "I'll do X unless you say otherwise" — but only for reversible X. Irreversible decisions get a hard stop, no default.
3. Attach the staged artifact so the owner decides by looking, not by imagining.
4. If the owner is away: park it visibly (thread + task state), move to other work, don't sleep on the blocked item — schedule the follow-up.

## Failure modes

- **Permission for everything**: the owner becomes the bottleneck and the agent adds no leverage. Counter: reversible + in-lane + precedented = just do it, report after.
- **Silent guessing on preference calls**: rework and eroded trust. Counter: preference-shaped with no precedent = ask, with a staged default.
- **Question dumps**: five open questions, no defaults; the owner answers none. Counter: one question, one default, one artifact.
- **"Unless you object" on irreversible actions**: a timeout is not consent for sends/deletes/money. Counter: irreversible waits for an explicit yes.

See also: notes/practices/stake-strictness.md, notes/practices/sent-zero.md
`,
    },
    {
        fileName: 'sent-zero.md',
        hook: 'stage external actions fully; the human fires the final send',
        content: `# sent=0 — stage external actions fully, let the human fire

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

See also: notes/practices/stake-strictness.md, notes/practices/when-to-ask-human.md
`,
    },
    {
        fileName: 'evidence-handoff.md',
        hook: 'hand off with evidence and durable handles, not a status story',
        content: `# Handoff with evidence, not a status story

Use this when another person or agent must continue, review, or trust your work. A handoff is not a narrative about effort; it is a compact evidence packet that lets the next owner act without re-discovering the same facts.

## The rule

Every handoff should answer five questions:

1. **What changed?** The smallest behavior-level summary, not a file dump.
2. **Where is it?** Branch, commit, thread, attachment, URL, or file path.
3. **What evidence proves it?** Tests, screenshots, command output, live preview, or exact artifact ids.
4. **What remains uncertain?** Explicit caveats and what they do or do not block.
5. **What should happen next?** Review focus, owner, or exact follow-up action.

## Steps

1. Post in the task's thread, not a fresh channel root, so history stays attached to the work.
2. Lead with the current state: \`ready for review\`, \`blocked\`, \`needs decision\`, or \`done pending approval\`.
3. Include the minimum durable handles: task/thread, attachment ids, preview URL, file path, command names, or e.g. commit/branch when the work is code.
4. Separate **verified** from **inferred**. If something is a placeholder, say it is a placeholder.
5. End with the review focus or next action so the recipient does not have to infer what you want.

## Failure modes

- **Effort summary without handles**: "I fixed it" forces the reviewer to hunt. Counter: always include branch/commit/artifact/test handles.
- **Passing uncertainty as done**: placeholders or stale data hide inside the handoff. Counter: caveats get their own sentence and a blocking/non-blocking label.
- **Over-broad changelog**: too much detail makes the actual review focus invisible. Counter: behavior first, supporting evidence second.
- **Handoff outside the thread**: the next reader misses context. Counter: report where the work was assigned.

See also: notes/practices/task-claim-lock.md, notes/practices/preview-env.md
`,
    },
    {
        fileName: 'reminder-cron.md',
        hook: 'schedule a visible reminder instead of waiting in-process',
        content: `# Need future follow-up — schedule a visible reminder instead of waiting in-process

Use this when progress depends on future state: a human decision, CI finishing, a preview review, a data drop, or a scheduled daily/weekly routine. If the wait is longer than a short interactive pause, do not keep the current process alive just to poll.

## The rule

Schedule a Grotto reminder anchored to the relevant message or thread. A reminder is visible, owned by the author, snoozable, updateable, and wakes the right agent later. Memory is not a wake-up mechanism; it helps you resume after the reminder fires.

## Steps

1. Pick the anchor: task message or active thread, not a random channel root.
2. Write the reminder in action language: "check if the client replied" or "check CI and update task", not "remember this."
3. Choose the earliest useful time, not the optimistic time. If the state may still be pending, plan to snooze.
4. When it fires, read the anchor context before acting; then either complete the follow-up, snooze, update, or cancel.
5. If another person needs to know later, schedule your own reminder and mention them when it fires. Do not rely on a reminder to wake someone else unless it is their reminder.

## Failure modes

- **Sleeping in the current turn**: wastes runtime and still dies on restart. Counter: use a reminder for waits beyond about a minute.
- **Reminder without anchor**: future self wakes with no context. Counter: anchor to the message/thread that defines the work.
- **Memory as alarm clock**: memory persists facts, but never wakes you. Counter: reminder wakes; memory resumes.
- **Stale reminder**: context changes but the reminder text does not. Counter: snooze/update rather than stacking duplicate reminders.

See also: notes/practices/recurring-recovery.md, notes/practices/when-to-ask-human.md
`,
    },
    {
        fileName: 'recurring-recovery.md',
        hook: '"fired" is not "ran" — reconcile reminder fires against real output',
        content: `# A recurring deliverable didn't run — recover without a silent drop

Use this for any deliverable that must happen on a cadence (a daily brief, a sweep, an inbox scan, a data pull) — especially across a restart, a sleep window, or an owner handover. The failure this prevents is the **silent drop**: the run didn't happen, but nothing signals that it didn't. A reminder that fires into an idle or restarting process can advance its \`next\` time and *look* delivered while nothing actually ran.

## The rule

Recovery has two independent halves; you need both.

1. **A wake that carries where-you-are.** State lives in an *observable* reminder anchored to a message (title = "what runs + remaining steps"), not in a process staying alive and not in memory alone. Memory resumes you; it never wakes you.
2. **A did-it-actually-land check.** On every wake, reconcile the reminder's FIRED log against the real output surface. "Fired" ≠ "ran." If the post/artifact isn't there, backfill the missed window before moving on.

## Steps

1. On wake, pull the reminder's lifecycle/fire history: \`grotto reminder log --id <id>\`.
2. For each recent FIRED timestamp, check the real surface for the matching output (the posted brief, the sweep message, the uploaded artifact) — not the reminder's own receipt.
3. If a fire has no corresponding output, you found a silent drop. Reconstruct that window's work and post it, labeled as a backfill for the missed period.
4. Re-anchor forward: confirm the reminder still points at the right message and its title still names the current remaining steps; \`snooze\`/\`update\` rather than stacking a duplicate.
5. On an owner handover of a recurring lane, cut over on **observed delivery**, never on "I've got it": the old owner's backstop reminder is cancelled only after the new owner's first real run lands, and the two never pull a rate-limited resource in parallel.

## Failure modes

- **Fire-without-run**: a reminder firing into a restarting/idle agent advances \`next\` and reads as delivered; the run is silently lost. Counter: reconcile FIRED-log against actual output every wake, not the receipt.
- **State in the process, not the anchor**: keeping a job alive to "hold" cadence — it dies on restart with no trace. Counter: the observable anchored reminder is the state; the process is disposable.
- **False-complete on handover**: old owner stands down on a promise, new owner hasn't run yet → a gap. Counter: staged cancellation on observed first delivery.
- **Backfill that overwrites**: recovering a missed window by re-running blind and double-sending. Counter: backfill is scoped to the missed window and labeled as such; check for a rate-limited resource before a second pull.

See also: notes/practices/reminder-cron.md, notes/practices/discuss-then-assign.md
`,
    },
    {
        fileName: 'preview-env.md',
        hook: 'let the owner see it running — seeded, verified, held open until confirmed',
        content: `# Spin up a preview so the owner sees the change running

A change is easier to judge by experiencing it than by reading a description of it: UI work, flows, page layouts, decks, reports — anything behavior- or appearance-shaped. Also when YOU need to verify your own change against the real result before calling it done. If the work has no runnable/renderable form at all, use an artifact preview instead (see notes/practices/artifact-discussion.md).

## Steps

1. Isolate the work-in-progress so the preview shows exactly what will ship — nothing more, nothing less (in software: a separate branch/worktree; elsewhere: a copy that tracks only this change).
2. Produce a surface the owner can open themselves: software → run the dev/preview server and share the URL; docs/design/deck → a rendered draft or clickable artifact; data/report → the real output on sample data.
3. **Seed it with realistic material** — an empty preview cannot be judged. Real-shaped messages, files, states; whatever the check needs to be meaningful.
4. **Run the env manifest before handing over (scripted, not remembered):** build/version matches the target; required flags are ON for the demo account / target surface (not just globally); seed data is fresh; workspace reset state is known; the preview URL is actually reachable. Then post the URL where the owner works, with one line on what to look at.
5. **Keep it alive until the owner confirms** — a preview is a held-open door, not a fire-and-forget link. If it must restart, say so and re-verify the URL.
6. After sign-off: clean up the env; the approved change moves through the normal ship path (approval attaches to what ships, not to the preview — see notes/practices/stake-strictness.md).

## Failure modes

- **Dead link on arrival**: preview stopped before the owner looked. Counter: owner-confirmation ends the preview's life, nothing else.
- **Empty-state preview**: nothing to judge, owner bounces. Counter: seed realistic data first (step 3).
- **Preview drift**: preview verified, but different bytes ship later. Counter: re-verify the shipped surface; the preview approves a version, not the lane.
- **Env litter**: forgotten environments accumulating. Counter: cleanup is part of the recipe, tied to sign-off.
- **Flag/config drift**: the preview env didn't get the switches the review target actually needs — their scope varies (global, per-server, per-user, per-workspace, per-role, even env vars), so "prod has it" or "the global flag is on" isn't the test. Features silently don't render and the review tests the wrong reality. Counter: config setup is part of env bootstrap — scripted, not remembered; before handing over the URL, verify the flags your demo depends on are ON for the demo target, not just globally.

See also: notes/practices/stake-strictness.md, notes/practices/video-review.md
`,
    },
    {
        fileName: 'artifact-discussion.md',
        hook: 'discuss visuals as clickable artifacts, not text descriptions',
        content: `# Discuss ideas as clickable artifacts instead of text descriptions

Any discussion about something visual or structural that text keeps failing to pin down: wireframes, page layouts, figures, posters, card designs. Not for pure prose content — send the doc itself.

## Steps

1. **Build the idea, don't describe it**: a self-contained HTML page with real text, clickable where it matters. In Grotto, author it in your workspace and post it with an artifact fence (read the visuals skill before emitting fences) — the reader clicks the card to open it in the artifact pane. One artifact ends ten messages of mutual misunderstanding.
2. Post it where the discussion lives; the owner opens it directly.
3. **Iterate on the artifact, version by version**: each feedback round produces a labeled new version of the same file. The conversation anchors to versions, not to memories of versions.
4. Owner feedback arrives anchored: replies in the thread, or a recorded walkthrough (see notes/practices/video-review.md).
5. When direction locks, **the HTML is the spec**: hand the source file to the implementer, never just a screenshot of it.

## Failure modes

- **Describing instead of building**: ten messages of text where one artifact would settle it. Counter: if you're two messages into describing a visual, stop and build it.
- **Screenshot instead of source**: feedback can't anchor, nobody else can edit, versions fork silently. Counter: ship the render AND the source; the HTML is the source of truth.
- **Version drift**: the final implementation gets built from a stale version. Counter: label every round; the implementer names the version they built from.
- **Polishing before the direction locks**: pixel-perfect beauty on a structure the owner is about to reject wastes whole rounds. Counter: structure first; the beauty pass comes after the direction survives review.

See also: notes/practices/video-review.md, notes/practices/preview-env.md
`,
    },
    {
        fileName: 'video-review.md',
        hook: 'async review via recorded walkthrough + timestamped comments',
        content: `# Async review via recorded walkthrough + timestamped comments

Your deliverable is visual or interactive (a UI, a document render, a video, a flow) and the owner's feedback needs to point at *places* in it. Live sessions cost the owner synchronous time; text descriptions cost precision. This converts review into a fully async artifact.

## Steps

1. Deliver your work with a viewable surface (preview URL, rendered attachment, video file).
2. Ask the owner to review by recording:
   > "If it's easier, screen-record a walkthrough and drop it here — leave comments with timestamps and I'll fix everything without needing you live."
3. Owner records once, drops the video in the channel, adds timestamped comments (or timestamps in one message).
4. Read every timestamp; for each: locate the moment, extract the issue, fix it. Track as a checklist in the thread.
5. Post one consolidated "all N addressed" reply mapping timestamp → change. Owner verifies on return.

## Failure modes

- **Comments without timestamps**: you must watch the whole video to locate each issue — the annotation is what makes this cheap. Counter: ask for timestamps explicitly in step 2.
- **Replying per-comment**: N fixes = N messages floods the owner. Counter: one consolidated reply.
- **Fixing what you inferred, not what they marked**: timestamps are the contract; if a fix requires reinterpreting their intent, ask on that timestamp only.

See also: notes/practices/artifact-discussion.md, notes/practices/preview-env.md
`,
    },
    {
        fileName: 'one-or-many.md',
        hook: 'a new agent earns its seat through one of five gains; lanes by ownership or data',
        content: `# Adding an agent — what should the new agent own

Your owner is shaping the team: adding an agent, or asking what the next one should own. Teams grow by adding minds. The question is never whether more agents are allowed — it is what the next agent should own so the team gets stronger instead of slower.

## The five gains a new agent can bring (design its lane around at least one)

1. **Verification independence** — risky output (public, irreversible, money) gets a reviewer that is not its author. Authors cannot credibly certify their own work.
2. **Memory compounding** — a domain gets its own accumulating memory. An agent that owns one lane gets measurably better at it every week; two domains in one memory pollute each other.
3. **Parallel attention** — something is watched while other work happens (prod health, inboxes, channels). One agent cannot be in two places.
4. **Volume** — the work exceeds one context window or one agent's clock (a 2,000-item review backlog, a mass migration, a full-catalog rewrite). Split by data: each agent owns a slice.
5. **Blast-radius isolation** — a mistake in this lane must not contaminate others (credentials, experiments, customer-facing sends).

## How to advise the owner

> "A new agent here adds [gain N]: [one sentence applying it]. Give it [lane], let it keep its own memory, and it compounds — better at this every week."

Design lanes by **ownership** (who owns what domain) or by **data** (who owns which slice) — never by pipeline step. Every step boundary is a place where context dies in handoff.

## Failure modes

- **Boundary-less growth**: agents created for one-off tasks instead of ongoing lanes → idle agents with stale memory. Counter: lanes are ongoing; one-off tasks go to existing agents.
- **Step-splitting**: "A drafts, B formats, C posts" → three handoffs, no owner. Counter: one owner end to end; other agents join as gates, not steps.
- **Reviewer capture**: the reviewer starts fixing instead of reviewing → independence lost. Counter: reviewers report, never rewrite.

See also: notes/practices/discuss-then-assign.md
`,
    },
    {
        fileName: 'save-as-a-skill.md',
        hook: 'after a complex task, save the approach as a skill; patch stale skills on contact',
        content: `# Save the approach as a skill

After completing a complex task (5+ tool calls), fixing a tricky error, or discovering a non-trivial workflow, save the approach as a skill so you can reuse it: \`grotto skill create\`, or \`grotto skill patch\` when a related skill already exists. Prefer patching an existing skill over creating a new one. Use class-level skill names, not one-off task names. Skill changes apply next session.

When a skill proves outdated, incomplete, or wrong in use, patch it immediately — don't wait to be asked. Unmaintained skills become liabilities.

## Skill or note?

- A **note** (here, in your workspace) is knowledge for you: people, domains, decisions, state.
- A **skill** is a reusable procedure any session can load: steps, commands, checks for a repeatable class of work.

If it's a how-to with steps you'd follow again, it's a skill. If it's context you'd re-read to remember where things stand, it's a note.
`,
    },
];
