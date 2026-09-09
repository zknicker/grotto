# Agent system prompt — Grotto vs Raft divergence register

Field-by-field diff of Grotto's composed Agent system prompt
(`apps/computer/src/harness/managed-instructions.ts`) against the prompt builder in
**Raft Computer 1.0.16** (`/Users/zknicker/.local/bin/raft-computer`, Node SEA binary dated
2026-08-10; extracted with `strings -n 6`). Diffed 2026-09-08.

Raft's builder is `buildPrompt` with per-section helpers (`buildCommunicationSection`,
`buildTasksSection`, `buildMentionsSection`, `buildConversationEtiquetteSection`, …) plus
`buildInitialMemoryMd` for the workspace seed. `strings` drops blank and short (<6 char) lines,
so section text recovered this way is exact per line but not per paragraph break.

**How to read this.** *Deliberate* means an owning spec or ADR requires the difference.
*TODO* means the difference exists without an owner and should either be justified or removed.
Grotto substitutes `grotto` for `raft` in every command name and `Grotto` for
`Raft (former Slock)` in prose; that substitution is assumed everywhere and not listed per row.

## Prompt size budget

`managed-instructions.test.ts` caps the composed prompt at 37,500 characters; today's render is
37,406. That number is a reviewed ratchet, not a runtime limit — no adapter enforces a length
(Codex developer instructions, the Claude Code system-prompt append, and Pi all accept more), and
Raft 1.0.16 renders roughly 41,900 characters with no size guard of its own. The budget was
introduced at 32,500 on 2026-08-18, raised seven times to 38,450, then lowered to 37,500 on
2026-09-07. It exists because prompt text changes the behavior of every Agent and the easiest fix
for any behavior is one more sentence.

The budget is split by origin. **Raft-verbatim text is the fixed part**: it is never trimmed,
paraphrased, or reordered to make room, and restoring a Raft clause that Grotto had replaced with
an analogue may raise the budget by exactly the restored amount, with the row below and a one-line
commit rationale. **Grotto-only text is the variable part**: an addition must fit inside the
current budget by simplifying or relocating other Grotto-only text into Manual topics or skills
(ADR 0012), never by cutting Raft text; raising the budget for Grotto-only growth needs an
explicit operator decision. Measured against Raft 1.0.16, Grotto's Raft-verbatim text is roughly
19,900 characters and its Grotto-only product text roughly 5,100.

Every change to the composed prompt adds, changes, or removes a row here and runs the prompt
contract suite. The `TODO — no owner` rows are the current debt.

## Restored to parity on 2026-09-08

These four were unowned drifts, not decisions, and each plausibly contributed to an unaddressed
Agent starting work another Agent had been asked to do:

| Field | Was | Now |
| --- | --- | --- |
| Tasks decision rule | "Most messages are not tasks… just do it and reply — never claim, never promote", plus a two-condition promotion rule | Raft's claim gate verbatim: action beyond replying → claim first; answering or conversing → no claim |
| Startup step 3 | Compressed notice text without the honest-deferral clause | Raft's wording, including "if you choose not to read, that is a deferral to report honestly" and "New messages may be delivered to you automatically while your process stays alive." |
| Startup step 4 | "Reply … only when a visible response is useful" | Raft's coupled "process it and reply with `grotto message send`", with the FYI carve-out demoted to one marked exception |
| @Mentions | Display-name bullet dropped | Raft's bullet restored: display name is presentation, identity reasoning uses the stable name |
| Workspace seed (`packages/agent-workspace/src/starter-kit.ts`) | An instruction to the Agent's first turn ("introduce yourself briefly, learn what you own") | Raft's inert `buildInitialMemoryMd` template: `No role defined yet.` / `- No notes yet.` / `- First startup.` |

## Section-by-section register

Sections are in Grotto's render order. "Parity" means the text matches Raft 1.0.16 apart from the
product-noun substitution.

| Section | Difference | Status / owner |
| --- | --- | --- |
| Identity line | `an AI agent in Grotto` vs `in Raft (former Slock)` | Deliberate — AGENTS.md coding rule 11 |
| Who you are | Parity | — |
| Current Runtime Context | Grotto renders `- Agent: @handle (id)`, Hostname, OS, Runtime, Workspace, Home timezone. Raft renders Agent ID, Server ID, `Computer: name (id)`, Hostname, OS, Daemon, Workspace, and has no timezone line | Deliberate — ADR 0019 (Server owns collaboration, Computer owns execution); the home timezone is load-bearing for the `time=` header (specs/messages.md) |
| How these instructions apply | Parity | — |
| Communication — CLI ONLY | Command families differ: Grotto drops Raft's admin channel/server management, Integrations, Wiki bridge, `raft version`, and `task assign/unassign/convert/delete`; Grotto adds Inbox, Triggers, Skills, Avatar generation, Asks, Cloud agents, and `channel info` | Deliberate — specs/grotto-cli.md is the CLI contract; ADRs 0021/0024/0027, specs/asks.md, specs/cloud-agents.md, specs/skills.md |
| Communication — error taxonomy | Grotto adds `INVALID_*`, `*_NOT_FOUND`, `AMBIGUOUS_ID`; drops Raft's "Command-syntax errors are emitted by the parser" sentence | Deliberate — specs/grotto-cli.md error contract |
| Credential handling | Grotto keeps both intent paragraphs; drops Raft's "**Profile credential resolution is strict**" paragraph | Deliberate — `--profile`/`RAFT_PROFILE`/`SLOCK_HOME` resolution has no Grotto equivalent; the Agent CLI wrapper carries identity (specs/grotto-cli.md §wrapper injection) |
| CRITICAL RULES | Parity | — |
| Startup step 1 | Grotto scopes the step to "a concrete incoming message" and says "acknowledgment, blocker question, or ownership signal" | TODO — cosmetic compression, no owner |
| Startup step 2 | Parity: "Read MEMORY.md (in your cwd) and then only the additional memory/files you need to handle the current turn well." | — |
| Startup step 3 | Parity **plus** "The notice is not itself a request, so do not acknowledge it." | Deliberate — specs/inbox.md §Golden flow ("a notice is not a request") |
| Startup step 4 | Parity **plus** "Grotto exception: an explicit FYI / no-response-needed message settles silently, with no send at all." | Deliberate — specs/inbox.md coverage row ("Agent instructions teach notice, pull, silence, and deferral semantics"); gated by `fyi-silence-channel` / `fyi-silence-dm` in `bun run eval:prompt` |
| Startup step 5 | Same requirement, shorter wording | TODO — cosmetic, no owner |
| Post-startup IMPORTANT note | Parity | — |
| Messaging header spec | Grotto adds `type=trigger`, the `@sender — <description>:` suffix, home-timezone `time=` semantics, and the assignee-receipt paragraph. Raft's `time=` is a bare timestamp and its `type=` set is `human`/`agent`/`system` | Deliberate — ADR 0027 (triggers), specs/agent-profile.md (description rides the envelope), specs/messages.md (local wall clock), ADR 0015 + ADR 0026 (assignment receipt) |
| Sending messages | Parity, including the draft-recovery paths | — |
| Reminders | Grotto drops Raft's "the receipt/fire system message is visible in that surface"; adds `--cause`, script reminders, and the `recipes/technique/reminder-cron` Manual pointer | Deliberate — ADR 0026 (a fire writes nothing to chat), ADR 0016, specs/automation-provenance.md |
| Triggers | Grotto-only section | Deliberate — ADR 0027, specs/triggers.md |
| Cloud agents | Grotto-only section | Deliberate — specs/cloud-agents.md |
| Threads | Parity ("When replying to a message from a thread" vs Raft's "When you receive a message from a thread" is the only wording delta) | — |
| Discovering people and channels | Parity | — |
| Channel awareness | Parity | — |
| Third-party app message safety | Raft-only section — Grotto has no `type=third_party_app` sender kind | Deliberate — specs/messages.md sender kinds; revisit if Grotto ever admits external app senders |
| Capability and execution-surface selection | Rewritten. Raft's section is about Raft Integrations and Agent Login; Grotto's is about Server-managed MCP grants and inventory separation | Deliberate — specs/mcp.md, ADR 0017; gated by `mcp-granted-lookup` / `mcp-revoked-honest-failure` |
| Reading history | Parity | — |
| Historical references | Parity | — |
| Tasks — decision rule, status flow, workflow steps 1–3, `task create`, creating new tasks | Parity | — |
| Tasks — "A system notification about task changes" bullet | Dropped | Deliberate — ADR 0015: "Task state changes do not create receipt messages" |
| Tasks — `closed` status | Additive sentence after Raft's status flow | Deliberate — ADR 0015 (reversible `closed`), specs/tasks.md |
| Tasks — same-turn completion | One additive divergence sentence: finish in the same turn → reply in the chat where the request was made (not the task's thread) and set it `done`, do not park it in `in_review`; the thread carries progress notes, questions, and work that outlives the turn | Deliberate — the register's single Tasks divergence; keeps `in_review` meaningful without recreating the "never claim" hole, and overrides workflow step 3's Raft-verbatim "post updates in the task's thread" for same-turn work (Grotto's two-tier background vs tracked task split) |
| Tasks — stale close | Additive sentence: an `in_review` task silent for `TASK_IN_REVIEW_STALE_DAYS` is closed as stale by the Server | Deliberate — `apps/server/src/tasks/close-stale-tasks.ts` |
| Tasks — `--assignee @peer`, receipts, Owners/Admins | Grotto replaces Raft's "A server owner/admin may use `--assignee @someone-else`" with peer assignment plus receipt semantics | Deliberate — ADR 0015 amended by ADR 0026 |
| Splitting tasks | Parity | — |
| @Mentions | Parity. Grotto renders one name, so the display-name bullet interpolates the same value twice | Deliberate — specs/identity.md has no separate Agent display name in the prompt render input |
| Communication style | Parity apart from contractions and the dropped "Self-check:" lead-in | TODO — cosmetic, no owner |
| Conversation etiquette | Parity **plus** two Grotto bullets: "**Silence is deliberate.**" and "**DM knowledge is not room knowledge.**" | Deliberate — specs/inbox.md coverage row (silence) and specs/sessions.md §"Knowledge and discretion" ("the prompt teaches discretion") |
| Live constraints and closure | Compressed. Raft's four declaration/propagation/reception/action seats and its closed-gate-set merge rule become two paragraphs | Deliberate — prompt budget; the load-bearing clauses are asserted in `instructions.test.ts` |
| Formatting — Mentions & Channel Refs | Grotto drops Raft's `#1` numeric channel form | Deliberate — Grotto has no numeric channel refs (specs/mentions.md) |
| Formatting — URLs | Parity | — |
| Workspace & Memory | Parity **plus** "Re-read MEMORY.md and update your notes at natural boundaries" and the "**Apply remembered preferences**" bullet. The "session resets rarely" rationale stays; `managed-instructions.test.ts` asserts it. | Deliberate — ADR 0009; sessions rotate rarely in Grotto, so startup-only reads are insufficient (specs/sessions.md) |
| What to memorize / How to organize | Parity | — |
| Compaction safety | Parity | — |
| Capabilities | Parity | — |
| Outputs | Grotto-only section (fences, artifact cards, `grotto://workspace/` links) | Deliberate — ADR 0003, ADR 0004, ADR 0010 |
| Visuals | Grotto-only section | Deliberate — ADR 0012 (design guidance is skill-carried) |
| Web access | Grotto-only section, rendered only when web access is granted | Deliberate — specs/tools.md |
| Message Notifications | Grotto adds "It is not itself a request, so do not acknowledge the notice" and describes `grotto message check` as reading locally cached bodies. Grotto renders only Raft's `direct` variant; Raft's `notice-example` variant is not ported | Deliberate — specs/inbox.md (notice is not a request; Computer-local pull cache) |
| Initial role | Parity | — |
| Runtime Profile Control | Raft-only section (daemon release notice injected as startup step 0) | Deliberate — Computer upgrades are operator-driven, ADR 0020 |
| Workspace seed (`starter-kit.ts`) | Parity with `buildInitialMemoryMd`'s non-Cindy branch | — |
| Cove seed (`cove-starter-kit.ts`) | Grotto-only four-file onboarding seed; Raft's Cindy branch is a different document set | Deliberate — ADR 0021 |

## CLI output surfaces

The Agent CLI's own printed guidance is not part of Raft's prompt, but it teaches the same
behaviours and is diffed here when it mirrors a Raft helper.

| Surface | Difference | Status / owner |
| --- | --- | --- |
| `grotto task claim` success hint | Raft's `formatClaimResults` prints a thread target per claimed task under "Follow up in each task's thread". Grotto prints "Follow up on each task:" and, per task, `#N → reply in <target> when done (same-turn work); use the thread "<target>:<shortId>" for progress notes, questions, or work that outlives this turn.` | Deliberate — Raft has no background/tracked split, so its unconditional thread hint pushes a same-turn answer out of the chat that asked for it and strands the requester. Mirrors the Tasks same-turn divergence above; the thread target string is still printed verbatim so it can be copied |

## Open TODOs

Three cosmetic rewrites carry no owner: startup steps 1 and 5, and the closing paragraph of
Communication style. They preserve every Raft requirement and cost nothing, so they are recorded
rather than reverted — but a future parity pass should either adopt Raft's wording or give them a
spec.

## Keeping this current

Re-diff whenever `managed-instructions.ts` or `starter-kit.ts` changes, and whenever a newer
`raft-computer` is installed. Regenerate the reference dump with:

```sh
strings -n 6 /Users/zknicker/.local/bin/raft-computer > raft-strings.txt
grep -n 'function build.*Section\|function buildPrompt\|function buildInitialMemoryMd' raft-strings.txt
```

Verification for a prompt edit is `bun run test:prompt-contract`, the Computer package gate, and
`bun run eval:prompt` (docs/operations/testing.md §Prompt Behavior Evals).
