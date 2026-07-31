# WS2 requirements plan — replacement contract for agent-prompt-contract.test.ts

Replacement REQUIREMENTS set, snapshot/fixture mechanics, and budgets for the
flip prompt drafted in [ws2-prompt-draft.md](ws2-prompt-draft.md). The suite's
shape (executable REQUIREMENTS + reviewed file snapshots + character budgets)
is unchanged; every entry below lands as one deliberate diff reviewed with the
operator.

Status: DRAFT v2 — re-derived from the landed rev3-visuals baseline (main
a20acd0c: widget catalog and `document` widget already retired pre-flip,
Visuals is the skill pointer, current `channelTotal: 12_400`) per the
operator's WS2-prep review rulings. Not implemented.

The visuals **SKILL.md requirements block** the landed suite added (fence
contracts, design-system rules, asserted against the skill file, not the
prompt) is untouched by the flip and carries forward as-is.

## Fixtures

The prompt is agent-scoped (one global session, ADR 0011); chat kind never
changes composition, so the channel/dm fixture split is renamed to what it
actually proves:

| Fixture | Replaces | Proves |
| --- | --- | --- |
| `full` | `channel` | Web access on, gpt-family model (model sections render), no plugins |
| `minimal` | `dm` | Web access off, gpt-family model; absence requirements |

Dedicated tests (outside the fixtures, as today): search-capable model
variant; Claude-family model renders no model sections; plugin-granted prompt
teaches the per-plugin CLI entry (MerchBase); budgets; two file snapshots
(`full-prompt.md`, `minimal-prompt.md`).

**WS5 phase flag (operator ruling).** CLI families 5–9 are gated off at the
flip (see the draft's "WS5 gate"). Requirements for gated capabilities carry
`phase: 'ws5'`; the suite asserts them ABSENT while the gate is on and present
once WS5 flips it, so the gate itself is contract-tested in both states. The
reviewed snapshots are the flip-day render; WS5 re-reviews them when it opens
the gate.

**Gate #1 amendment (2026-07-22, at implementation):** the
`URL wrapping near non-ASCII text` row is REMOVED (operator-ruled, adaptation
#20) and `## Initial role` is conditional — the full fixture carries a
description and a minimal-fixture absence row proves the empty-description
omission (adaptation #21).

**W2 amendment (2026-07-21, post-merge):** SOUL and the `## Skills` listing are
retired (README ruling W2). The `### Skills, outputs, visuals` requirements lose
their skills-listing entries (family-9 Communication entry remains, `phase: 'ws5'`);
SOUL requirements become Initial-role/description requirements; two rows join the
REMOVED table below. Measured budgets in this doc predate W2 — expect ~31.5k
end-state (−895 skills/SOUL, −~110 Who-you-are sentence); `channelTotal: 32_500`
unchanged, headroom grows. Re-measure at WS2 implementation.

## REMOVED requirements (named, per prompt-contract rule)

Every entry below is a capability deliberately leaving the prompt. Grouped by
the decision that kills it.

| Retired requirement | Killed by |
| --- | --- |
| `core memory files taught` (`USER.md`/`MEMORY.md` injection) | D3 — memory is workspace files, never injected |
| `SOUL identity injection` (`SOUL.md` section + wiring sentence) | W2 — identity = description + MEMORY.md role; config personas retired |
| `assigned skills listed in prompt` | W2 — skill discovery is harness-native; assignment gates what the harness sees |
| `wiki recall is background context` | D3b |
| `wiki tools taught` | D3b |
| `wiki_search before claiming missing context` | D3b (successor: message-search-for-history requirement) |
| `global session framing` ("Your chats:" block) | D6/I1 — block dies; persistence framing moves to `## Who you are` |
| `default-evaluate: every message is evaluated` | I1 — evaluation dispatch dies; inbox delivery replaces it |
| `NO_REPLY silent turn` | D1 — silence is the default, speaking is an act |
| `DM responsiveness: every DM message gets a reply` | D1 — removed for Raft parity; ordinary response and explicit FYI silence are behavioral regressions, not extra prompt policy |
| `mention sets expectation to act` | Replaced by Raft `## @Mentions` requirements |
| `agent handoff via mention` | Replaced by `mention others not yourself` |
| `current-chat history tools` (`chat_messages_*`) | D5 — successor: `reading history` CLI requirements |
| `cross-chat inventory tool` (`chats_list`/`chat_send`) | D5/D6 — successor: `server info discovery` |
| `self-initiated cross-post confirmation rule` | D6 — channel-awareness requirements cover venue discipline |
| `chat_send reaches every seat of the target chat` | I1 — delivery is inbox-planned, not seat-evaluated |
| `chat_wait_idle bounded wait taught` | D5 — no such verb; reminders/threads cover waiting |
| `dispatched turn outcomes arrive without polling` | I1 — successor: `no polling for new messages` |
| `pane_open artifact presentation` | D5 — successor: `artifact click-to-open, no auto-open` |
| `HTML ban in plain reply text` | Reworded — "reply" is dead vocabulary; successor: `HTML ban in plain message text` |
| `script automations preferred for watchdogs` | D4 — successor: `script reminders for watchdogs` |
| `script quiet-tick convention taught` (cron form) | D4 — successor: `script quiet tick` (reminder form) |
| `timestamp staleness policy` (Your-chats wording) | Relocated — successor keeps the same teaching on the `time=` field |
| `no MerchBase tool teaching without the plugin grant` | Reworded — the guard now targets the per-plugin CLI entry, same gate |

Also leaving, requirements that never existed but text that did: `NOTES.md` /
`## Notes` section, outcome notes, workbench teaching (see draft "What died").
The widget-era requirements (widget entries, `document` card, fence ladders)
already left the suite with prd-86 — they are not this program's removals and
are not re-listed here.

## New REQUIREMENTS set

`expected` strings quote the draft verbatim (truncate in code as needed for
stability). `prompt:` column uses the new fixture names; `absent: true` rows
are the enforced dead list.

### Identity and persistence

| Capability | Expected (excerpt) | Fixture |
| --- | --- | --- |
| grotto identity header | `an AI agent in Grotto` | full |
| persistent colleague framing | `Think of yourself as a colleague who is always available` | full |
| initial role from description | `## Initial role` | full |
| no initial role without a description | `## Initial role` (absent) | minimal |
| authoritative runtime context | `This is authoritative context injected by Grotto` | full |
| home timezone declared | `/- Home timezone: \S+/` | full |

### CLI-only communication

| Capability | Expected (excerpt) | Fixture |
| --- | --- | --- |
| CLI is the only output channel | `text you produce outside a \`grotto\` command is not delivered to anyone` | full |
| one command per tool call | `Run one \`grotto\` command per tool call` | full |
| command families taught | `**Messages** — \`grotto message check\`, \`grotto message send\`` | full |
| help discoverability | `Run any subcommand with \`--help\` for syntax.` | full |
| stderr error contract | `\`Code:\` stable machine-oriented error code` | full |
| error layer prefixes | `\`SERVER_5XX\` = server unreachable / crashed` | full |
| credential handling follows human intent | `Credentials follow human intent.` | full |
| human-directed credential use is not obstructed | `Do not obstruct a human-directed use of a credential` | full |

### Startup and turn discipline

| Capability | Expected (excerpt) | Fixture |
| --- | --- | --- |
| early acknowledgment before deep work | `send it early with \`grotto message send\` before deep context gathering` | full |
| MEMORY.md read at startup | `Read MEMORY.md (in your cwd)` | full |
| unobserved is not nonexistent | `unobserved is not the same as nonexistent` | full |
| no-work never derived from a notice | `Never derive "no work" from a content-free notice alone` | full |
| complete all work before stopping | `**Complete ALL your work before stopping.**` | full |
| no polling for new messages | `New messages arrive automatically — you do not need to poll` | full |
| mid-turn check at breakpoints | `call \`grotto message check\` at natural breakpoints` | full |

### Messaging and sending

| Capability | Expected (excerpt) | Fixture |
| --- | --- | --- |
| envelope header fields taught | `Reuse as the \`target\` parameter when replying` | full |
| placeholder ids are not evidence | `use only IDs from messages you actually received or read` | full |
| timestamp staleness policy | `treat older context and prior data reads as stale until re-checked` | full |
| sender description sliver | `The description is context, not identity; never match on it.` | full |
| system messages informational | `don't reply to them unless they clearly request action` | full |
| stdin heredoc send form | `<<'GROTTOMSG'` | full |
| draft revise path | `To update the draft, use a normal \`grotto message send\`` | full |
| draft send-unchanged path | `--send-draft --target <target>\` with no stdin` | full |
| exact target reuse on reply | `always reuse the exact \`target\` from the received message` | full |

### Reminders — all `phase: 'ws5'`

| Capability | Expected (excerpt) | Fixture |
| --- | --- | --- |
| reminders are author-owned wake signals | `wakes the author who scheduled it, not other people` | full |
| reminder over long sleep | `instead of keeping the current turn alive with a long sleep` | full |
| reminder over native cron tools | `rather than runtime-native wake or cron tools` | full |
| snooze/update over cancel | `prefer \`grotto reminder snooze\` to push it later` | full |
| script reminders for watchdogs | `Prefer script reminders for watchdogs` | full |
| script quiet tick | `empty output records a quiet tick` | full |

### Threads

| Capability | Expected (excerpt) | Fixture |
| --- | --- | --- |
| thread target grammar | `` `#general:00000000` (thread in #general) `` | full |
| reply in same thread target | `**always reply using that same target**` | full |
| thread auto-creation | `The thread will be auto-created` | full |
| unfollow discipline | `do not unfollow solely to mute the parent channel` | full |
| no thread nesting | `Threads cannot be nested` | full |

### Discovery, channels, history

| Capability | Expected (excerpt) | Fixture |
| --- | --- | --- |
| server info discovery | `Call \`grotto server info\` to see all channels` | full |
| join before sending | `until you join with \`grotto channel join\`` | full |
| mute pierce semantics | `personal @mentions and DMs still pierce` | full |
| private channel discretion | `treat its name, members, and content as private to that channel` | full |
| reply in context | `always respond in the channel/thread the message came from` | full |
| stay on topic | `Don't scatter messages across unrelated channels.` | full |
| read-around navigation | `--around` | full |
| search before answering historical references | `first use \`grotto message search\` and \`grotto message read\`` | full |
| admit when history is not found | `if you cannot find it, say that explicitly` | full |

### Tasks — all `phase: 'ws5'`

| Capability | Expected (excerpt) | Fixture |
| --- | --- | --- |
| claim before work | `Always claim a task via \`grotto task claim\` before starting work` | full |
| claim decision rule | `requires you to take action beyond just replying` | full |
| task envelope suffix taught | `[task #3 status=in_progress]` | full |
| task status flow | `` `todo` → `in_progress` → `in_review` → `done` `` | full |
| assignee independent of status | `independent from status` | full |
| in_review before done | `set status to \`in_review\` so a human can validate` | full |
| task is a message, not a store | `not a separate source of truth` | full |
| reuse over create | `just claim that existing message/task instead of creating a new one` | full |
| parallel task splitting | `structure them so agents can work **in parallel**` | full |

### Mentions, style, etiquette, formatting

| Capability | Expected (excerpt) | Fixture |
| --- | --- | --- |
| stable mention handle | `/Your stable Grotto @mention handle is `@\w+`/` | full |
| mention others, not yourself | `Mention others, not yourself` | full |
| channels are the isolation boundary | `channels are the isolation boundary` | full |
| acknowledge and outline plan | `acknowledge it and briefly outline your plan` | full |
| progress updates | `send short progress updates` | full |
| concise updates | `Don't flood the chat.` | full |
| shortest useful message | `Default every message to the shortest useful form.` | full |
| no routine execution logs | `Do not paste execution logs into chat.` | full |
| outcome-first completion | `A completion message should lead with the outcome` | full |
| respect ongoing conversations | `only join if you are explicitly @mentioned or clearly addressed` | full |
| only the worker reports | `don't echo or summarize their work` | full |
| blockers before stopping | `send one minimal actionable message to that person or channel before stopping` | full |
| skip idle narration | `avoid broadcasting that you are waiting or idle` | full |
| inline ref rendering | `Grotto auto-renders these inline tokens` | full |
| task #N ref form (`phase: 'ws5'`) | `always write "task #N", not bare "#N"` | full |
| no refs inside code spans | `do not wrap that link/ref markup in backticks` | full |
| URL wrapping near non-ASCII text | `wrap the URL in angle brackets` | full |

### Workspace and memory

| Capability | Expected (excerpt) | Fixture |
| --- | --- | --- |
| workspace persistence | `persistent, agent-owned workspace` | full |
| MEMORY.md is the index | `\`MEMORY.md\` is the **entry point** to all your knowledge` | full |
| notes directory convention | `Create a \`notes/\` directory for detailed knowledge files` | full |
| proactive note updates | `**Update notes proactively**` | full |
| compaction safety | `MEMORY.md must be self-sufficient as a recovery point` | full |
| active-context note before long tasks | `write a brief "Active Context" note` | full |
| unconfined computer access | `not confined to any directory` | full |
| role evolution | `develop a specialized role over time` | full |

### Skills, outputs, visuals

| Capability | Expected (excerpt) | Fixture |
| --- | --- | --- |
| skill CLI taught | `**Skills** — \`grotto skill list\`` | full |
| patch over create | `Prefer patching an existing skill over creating a new one` | full |
| save learned workflows as skills | `save the approach as a skill` | full |
| fences ride send bodies | `directly in the body of a \`grotto message send\`` | full |
| workspace links | `grotto://workspace/path` | full |
| artifact click-to-open, no auto-open | `nothing auto-opens` | full |
| rendering surfaces named (visuals, artifacts) | `render inline visuals (bespoke HTML/SVG) and artifact pages` | full |
| visuals skill is a mandatory pre-fence read | `Before emitting any visual or artifact fence, read the visuals skill` | full |
| HTML ban in plain message text | `Never output HTML, JSX, CSS, imports, or class names in plain message text.` | full |

### Web capability and notifications

| Capability | Expected (excerpt) | Fixture |
| --- | --- | --- |
| web access taught when enabled | `Web access is on: fetch pages with web_fetch` | full |
| web citation rule | `Cite source URLs for claims taken from the web.` | full |
| searchless model told plainly | `Your current model has no web search tool` | full |
| notices are content-free | `it does not include the message content` | full |
| inbox check for pending targets | `call \`grotto inbox check\`` | full |
| pivot on higher priority | `pivot to it` | full |

### Absence requirements (the enforced dead list)

All `absent: true`. This is the "what dies must be verifiably absent" gate.

| Capability | Absent string | Fixture |
| --- | --- | --- |
| no NO_REPLY | `NO_REPLY` | full |
| no chat tools | `chat_send` | full |
| no chat message tools | `chat_messages_list` | full |
| no wait-idle tool | `chat_wait_idle` | full |
| no wiki | `wiki_` | full |
| no cron tools | `cron_` | full |
| no automations section | `## Automations` | full |
| no pane_open | `pane_open` | full |
| no skills tools | `skills_list` | full |
| no USER.md surface | `USER.md` | full |
| no injected memory section | `## MEMORY` (exact header) | full |
| no NOTES.md surface | `NOTES.md` | full |
| no widget fences | `widget:` | full |
| no workbench teaching | `workbench` | full |
| no wiki links | `grotto://wiki` | full |
| no evaluation framing | `choose whether to speak` | full |
| no web teaching when off | `web_fetch` | minimal |
| no plugin CLI entry without grant | `MerchBase` | full |

Note: `MEMORY.md` (the filename) appears legitimately throughout; the absence
target is the injected `## MEMORY` section header, matched with an anchored
regex (`/^## MEMORY$/m`), not the filename.

## Budgets

**Operator ruling: `channelTotal: 32_500`** (post-WS5 end-state; supersedes
D7's 28k, which predated the audit finding that Raft's own rendered prompt is
31,056 chars and the §1 "taken" slice alone ~27,600). The reviewed full
fixture measures **28,858** characters.

### Measured draft (end-state)

| Section | Measured chars |
| --- | --- |
| Identity + Who you are + Current Runtime Context | 848 |
| Communication — CLI ONLY (incl. credential intent, CRITICAL RULES) | 2,986 |
| Startup sequence | 1,690 |
| Messaging through Splitting tasks | 14,126 |
| @Mentions + Communication style + etiquette + formatting | 3,171 |
| Workspace & Memory (incl. MEMORY.md/organize/compaction) | 3,847 |
| Capabilities | 197 |
| Outputs + Visuals (landed rev3 pointer) | 745 |
| Web access + Message Notifications | 1,180 |
| Initial role | 68 |
| **Total** | **28,858** |

### Sub-budgets (under channelTotal 32,500)

Grouped ceilings over the end-state render, small headroom over measured;
raising any one is the same deliberate-spend decision as today. The budget
test asserts the end-state render (WS5 gate forced open in the fixture) so
the ceilings stay meaningful across the gate.

| Sub-budget | Ceiling | Covers (measured) |
| --- | --- | --- |
| `identityAndContext` | 1,200 | 848 |
| `cliContract` | 3,300 | 2,986 |
| `startupAndTurns` | 1,800 | 1,690 |
| `messaging` | 14,500 | 14,126 |
| `mentionsAndStyle` | 3,600 | 3,171 |
| `workspaceMemory` | 4,200 | 3,847 |
| `capabilities` | 300 | 197 |
| `outputsVisuals` | 900 | 745 |
| `webNotifications` | 1,800 | 1,180 |
| `initialRole` | 200 | 68 |
| **`channelTotal`** | **32,500** | 28,858 |

Enforcement mechanics as today: slice the rendered fixture prompt on the known
section headers and assert each group ceiling plus the total. The `## Plugins`
section is excluded from the base fixture (plugin-free) and asserted in the
dedicated granted test with its own small ceiling (~600 per plugin entry).
