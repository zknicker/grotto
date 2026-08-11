import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
    agentRuntimeMutationHeaders,
    agentRuntimeMutationOrigins,
    agentRuntimeRoutes,
} from '@tavern/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultVisualsSkill, visualsSkillFiles } from '../agent-engine/visuals-skill.ts';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { handleTimezoneSettingsRequest } from '../timezone-settings.ts';
import type { AgentExecutorInput } from './agent-executor.ts';
import { buildAgentInstructions } from './agent-instructions.ts';
import { upsertStoredAgent } from './agents-store.ts';

/**
 * PROMPT CONTRACT — read before editing this file or any prompt source.
 *
 * This suite is the executable requirements list for the composed agent
 * system prompt (the Raft-template body per ws2-prompt-draft.md). Every entry
 * in REQUIREMENTS names a capability
 * agents MUST keep being taught; the snapshots make every prompt edit
 * reviewable as a text diff; the budgets stop silent token growth.
 *
 * For AI assistants working in this repo:
 * - Never delete or weaken a requirement just to make this suite pass.
 *   A failing requirement means a capability was removed from the prompt —
 *   stop and confirm with the operator that the removal is intentional.
 * - When you change prompt text, show the operator the snapshot diff and
 *   get explicit confirmation before shipping.
 * - When you add a prompt-taught capability, add a requirement here in the
 *   same change.
 * See AGENTS.md ("Agent system prompt changes") and
 * specs/raft-alignment/ws2-requirements-plan.md.
 *
 * REMOVED requirements (the flip, 2026-07-22 — every entry is a capability
 * deliberately leaving the prompt, named per the prompt-contract rule;
 * decisions in specs/raft-alignment/README.md):
 * - `core memory files taught` (USER.md/MEMORY.md injection) — D3
 * - `SOUL identity injection` — W2 (identity = description + MEMORY.md role)
 * - `assigned skills listed in prompt` — W2 (skill discovery is harness-native)
 * - `skill capture/patch teachings` (save-as-skill, patch-over-create,
 *   unlisted-skill guardrails, provider-setup ban) — W2 (moves to WS8 seeded
 *   notes; management verbs are CLI family 9, WS5)
 * - `wiki recall is background context` — D3b
 * - `wiki tools taught` — D3b
 * - `wiki_search before claiming missing context` — D3b (successor:
 *   search-before-answering-historical-references)
 * - `global session framing` ("Your chats:" block) — D6/I1 (persistence
 *   framing moved to ## Who you are)
 * - `default-evaluate: every message is evaluated` — I1
 * - `NO_REPLY silent turn` — D1 (silence is the default, speaking is an act)
 * - `DM responsiveness: every DM message gets a reply` — D1 (removed for
 *   direct Raft prompt parity; ordinary response behavior is model judgment)
 * - `mention sets expectation to act` — replaced by Raft ## @Mentions rows
 * - `agent handoff via mention` — replaced by mention-others-not-yourself
 * - `current-chat history tools` (chat_messages_*) — D5 (successor: reading
 *   history CLI rows)
 * - `cross-chat inventory tool` (chats_list/chat_send) — D5/D6 (successor:
 *   server info discovery)
 * - `self-initiated cross-post confirmation rule` — D6
 * - `chat_send reaches every seat of the target chat` — I1
 * - `chat_wait_idle bounded wait taught` — D5
 * - `dispatched turn outcomes arrive without polling` — I1 (successor:
 *   no-polling-for-new-messages)
 * - `pane_open artifact presentation` — D5 (successor: artifact
 *   click-to-open, no auto-open)
 * - `HTML ban in plain reply text` — reworded (successor: HTML ban in plain
 *   message text)
 * - `script automations preferred for watchdogs` — D4 (successor: script
 *   reminders, ws5)
 * - `script quiet-tick convention taught` (cron form) — D4 (successor:
 *   script quiet tick, ws5)
 * - `timestamp staleness policy` (Your-chats wording) — relocated to the
 *   `time=` header-field teaching
 * - `URL wrapping near non-ASCII text` — dropped (operator-ruled):
 *   English-only workspace; the section's value is language-conditional —
 *   re-add if agents ever produce CJK content.
 * - `no MerchBase tool teaching without the plugin grant` — reworded after
 *   external integrations moved to self-documenting MCP tools. The absence
 *   row below enforces that integration-specific teaching stays out of the
 *   shared prompt.
 * Text that also left without ever being a named requirement: NOTES.md /
 * ## Notes section, outcome notes, workbench teaching, Files section.
 */
interface PromptRequirement {
    absent?: true;
    capability: string;
    expected: RegExp | string;
    prompt: 'full' | 'minimal';
}

const REQUIREMENTS: PromptRequirement[] = [
    // Identity and persistence.
    { capability: 'grotto identity header', expected: 'an AI agent in Grotto', prompt: 'full' },
    {
        capability: 'persistent colleague framing',
        expected: 'Think of yourself as a colleague who is always available',
        prompt: 'full',
    },
    {
        capability: 'initial role from description (W2)',
        expected: '## Initial role\n\nRuns the contract fixtures desk. This may evolve.',
        prompt: 'full',
    },
    // Raft parity: the section is optional — no description, no section.
    {
        absent: true,
        capability: 'no initial role without a description',
        expected: '## Initial role',
        prompt: 'minimal',
    },
    {
        capability: 'authoritative runtime context',
        expected: 'This is authoritative context injected by Grotto',
        prompt: 'full',
    },
    { capability: 'home timezone declared', expected: /- Home timezone: \S+/u, prompt: 'full' },
    // CLI-only communication.
    {
        capability: 'CLI is the only output channel',
        expected: 'text you produce outside a `grotto` command is not delivered to anyone',
        prompt: 'full',
    },
    {
        capability: 'one command per tool call',
        expected: 'Run one `grotto` command per tool call',
        prompt: 'full',
    },
    {
        capability: 'command families taught',
        expected: '**Messages** — `grotto message check`, `grotto message send`',
        prompt: 'full',
    },
    {
        capability: 'Manual command family and overview pointer',
        expected:
            '**Manual** — `grotto manual get <topic>`, `grotto manual search <keywords>`; start with `grotto manual get grotto-cli-overview`.',
        prompt: 'full',
    },
    {
        capability: 'help discoverability',
        expected: 'Run any subcommand with `--help` for syntax.',
        prompt: 'full',
    },
    {
        capability: 'stderr error contract',
        expected: '`Code:` stable machine-oriented error code',
        prompt: 'full',
    },
    {
        capability: 'error layer prefixes',
        expected: '`SERVER_5XX` = server unreachable / crashed',
        prompt: 'full',
    },
    {
        capability: 'credential handling follows human intent',
        expected: 'Credentials follow human intent.',
        prompt: 'full',
    },
    {
        capability: 'human-directed credential use is not obstructed',
        expected: 'Do not obstruct a human-directed use of a credential',
        prompt: 'full',
    },
    // Startup and turn discipline.
    {
        capability: 'early acknowledgment before deep work',
        expected: 'send it early with `grotto message send` before deep context gathering',
        prompt: 'full',
    },
    {
        capability: 'explicit FYI messages settle silently',
        expected: 'explicit FYI / no-response-needed messages should settle silently',
        prompt: 'full',
    },
    {
        capability: 'MEMORY.md read at startup',
        expected: 'Read MEMORY.md (in your cwd)',
        prompt: 'full',
    },
    {
        capability: 'unobserved is not nonexistent',
        expected: 'unobserved is not the same as nonexistent',
        prompt: 'full',
    },
    {
        capability: 'no-work never derived from a notice',
        expected: 'Never derive "no work" from a content-free notice alone',
        prompt: 'full',
    },
    {
        capability: 'notice is not a request',
        expected: 'The notice is not itself a request',
        prompt: 'full',
    },
    {
        capability: 'complete all work before stopping',
        expected: '**Complete ALL your work before stopping.**',
        prompt: 'full',
    },
    {
        capability: 'no polling for new messages',
        expected: 'New messages arrive automatically — you do not need to poll',
        prompt: 'full',
    },
    {
        capability: 'mid-turn check at breakpoints',
        expected: 'call `grotto message check` at natural breakpoints',
        prompt: 'full',
    },
    // Messaging and sending.
    {
        capability: 'envelope header fields taught',
        expected: 'Reuse as the `target` parameter when replying',
        prompt: 'full',
    },
    {
        capability: 'placeholder ids are not evidence',
        expected: 'use only IDs from messages you actually received or read',
        prompt: 'full',
    },
    {
        capability: 'timestamp staleness policy',
        expected: 'treat older context and prior data reads as stale until re-checked',
        prompt: 'full',
    },
    {
        capability: 'sender description sliver',
        expected: 'The description is context, not identity; never match on it.',
        prompt: 'full',
    },
    {
        capability: 'system messages informational',
        expected: "don't reply to them unless they clearly request action",
        prompt: 'full',
    },
    { capability: 'stdin heredoc send form', expected: "<<'GROTTOMSG'", prompt: 'full' },
    {
        capability: 'draft revise path',
        expected: 'To update the draft, use a normal `grotto message send --target <target>`',
        prompt: 'full',
    },
    {
        capability: 'draft send-unchanged path',
        expected: '--send-draft --target <target>` with no stdin',
        prompt: 'full',
    },
    {
        capability: 'exact target reuse on reply',
        expected: 'Reuse the exact `target` from the received message for ordinary replies',
        prompt: 'full',
    },
    {
        capability: 'explicit final delivery overrides ordinary reply routing',
        expected:
            'For a final result, an explicit human delivery instruction wins: deliver it once to the exact target named; "here" means the instruction message\'s target.',
        prompt: 'full',
    },
    // Reminders (D4, landed with WS5).
    {
        capability: 'reminders are author-owned wake signals',
        expected: 'wakes the author who scheduled it, not other people',
        prompt: 'full',
    },
    {
        capability: 'reminder over long sleep',
        expected: 'instead of keeping the current turn alive with a long sleep',
        prompt: 'full',
    },
    {
        capability: 'reminder over native cron tools',
        expected: 'rather than runtime-native wake or cron tools',
        prompt: 'full',
    },
    {
        capability: 'snooze/update over cancel',
        expected: 'prefer `grotto reminder snooze` to push it later',
        prompt: 'full',
    },
    {
        capability: 'script reminders for watchdogs',
        expected: 'Prefer script reminders for watchdogs',
        prompt: 'full',
    },
    {
        capability: 'script quiet tick',
        expected: 'empty output records a quiet tick',
        prompt: 'full',
    },
    // Threads.
    {
        capability: 'thread target grammar',
        expected: '`#general:00000000` (thread in #general)',
        prompt: 'full',
    },
    {
        capability: 'reply in same thread target',
        expected: '**always reply using that same target**',
        prompt: 'full',
    },
    {
        capability: 'thread auto-creation',
        expected: 'The thread will be auto-created',
        prompt: 'full',
    },
    {
        capability: 'unfollow discipline',
        expected: 'do not unfollow solely to mute the parent channel',
        prompt: 'full',
    },
    { capability: 'no thread nesting', expected: 'Threads cannot be nested', prompt: 'full' },
    // Discovery, channels, history.
    {
        capability: 'server info discovery',
        expected: 'Call `grotto server info` to see all channels',
        prompt: 'full',
    },
    {
        capability: 'join before sending',
        expected: 'until you join with `grotto channel join',
        prompt: 'full',
    },
    {
        capability: 'mute pierce semantics',
        expected: 'personal @mentions and DMs still pierce',
        prompt: 'full',
    },
    {
        capability: 'private channel discretion',
        expected: 'treat its name, members, and content as private to that channel',
        prompt: 'full',
    },
    {
        capability: 'reply in context',
        expected: 'always respond in the channel/thread the message came from',
        prompt: 'full',
    },
    {
        capability: 'stay on topic',
        expected: "Don't scatter messages across unrelated channels.",
        prompt: 'full',
    },
    { capability: 'read-around navigation', expected: '--around', prompt: 'full' },
    {
        capability: 'search before answering historical references',
        expected: 'first use `grotto message search` and `grotto message read`',
        prompt: 'full',
    },
    {
        capability: 'admit when history is not found',
        expected: 'if you cannot find it, say that explicitly',
        prompt: 'full',
    },
    // Tasks (D8, landed with WS5).
    {
        capability: 'claim before work',
        expected: 'Always claim a task via `grotto task claim` before starting work',
        prompt: 'full',
    },
    {
        capability: 'failed claim stops work',
        expected:
            'If the claim fails, do not work on that task unless an owner/admin explicitly redirects it to you.',
        prompt: 'full',
    },
    {
        capability: 'claim decision rule',
        expected: 'requires you to take action beyond just replying',
        prompt: 'full',
    },
    {
        capability: 'task envelope suffix taught',
        expected: '[task #3 status=in_progress]',
        prompt: 'full',
    },
    {
        capability: 'task status flow',
        expected: '`todo` → `in_progress` → `in_review` → `done`',
        prompt: 'full',
    },
    {
        capability: 'assignee independent of status',
        expected: 'independent from status',
        prompt: 'full',
    },
    {
        capability: 'in_review before done',
        expected: 'set status to `in_review` so a human can validate',
        prompt: 'full',
    },
    {
        capability: 'task final here stays on the human instruction target',
        expected:
            '"Here" always means the human instruction message\'s target, never the Task Thread you moved into.',
        prompt: 'full',
    },
    {
        capability: 'task is a message, not a store',
        expected: 'not a separate source of truth',
        prompt: 'full',
    },
    {
        capability: 'reuse over create',
        expected: 'just claim that existing message/task instead of creating a new one',
        prompt: 'full',
    },
    {
        capability: 'parallel task splitting',
        expected: 'structure them so agents can work **in parallel**',
        prompt: 'full',
    },
    // Skills (management is CLI family 9; discovery is harness-native per
    // W2, so the list entry is the only prompt surface).
    {
        capability: 'skill CLI family taught',
        expected: '**Skills** — `grotto skill list`',
        prompt: 'full',
    },
    // Mentions, style, etiquette, formatting.
    {
        capability: 'stable mention handle',
        expected: /Your stable Grotto @mention handle is `@\w+`/u,
        prompt: 'full',
    },
    {
        capability: 'mention others, not yourself',
        expected: 'Mention others, not yourself',
        prompt: 'full',
    },
    {
        capability: 'channels are the isolation boundary',
        expected: 'channels are the isolation boundary',
        prompt: 'full',
    },
    {
        capability: 'acknowledge and outline plan',
        expected: 'acknowledge it and briefly outline your plan',
        prompt: 'full',
    },
    { capability: 'progress updates', expected: 'send short progress updates', prompt: 'full' },
    { capability: 'concise updates', expected: "Don't flood the chat.", prompt: 'full' },
    {
        capability: 'shortest useful message',
        expected: 'Default every message to the shortest useful form.',
        prompt: 'full',
    },
    {
        capability: 'no routine execution logs',
        expected: 'Do not paste execution logs into chat.',
        prompt: 'full',
    },
    {
        capability: 'outcome-first completion',
        expected: 'A completion message should lead with the outcome',
        prompt: 'full',
    },
    {
        capability: 'respect ongoing conversations',
        expected: 'only join if you are explicitly @mentioned or clearly addressed',
        prompt: 'full',
    },
    {
        capability: 'only the worker reports',
        expected: "don't echo or summarize their work",
        prompt: 'full',
    },
    {
        capability: 'blockers before stopping',
        expected: 'send one minimal actionable message to that person or channel before stopping',
        prompt: 'full',
    },
    {
        capability: 'skip idle narration',
        expected: 'avoid broadcasting that you are waiting or idle',
        prompt: 'full',
    },
    {
        capability: 'inline ref rendering',
        expected: 'Grotto auto-renders these inline tokens',
        prompt: 'full',
    },
    {
        capability: 'task #N ref form',
        expected: 'always write "task #N", not bare "#N"',
        prompt: 'full',
    },
    {
        capability: 'no refs inside code spans',
        expected: 'do not wrap that link/ref markup in backticks',
        prompt: 'full',
    },
    // Workspace and memory.
    {
        capability: 'workspace persistence',
        expected: 'persistent, agent-owned workspace',
        prompt: 'full',
    },
    {
        capability: 'MEMORY.md is the index',
        expected: '`MEMORY.md` is the **entry point** to all your knowledge',
        prompt: 'full',
    },
    {
        capability: 'notes directory convention',
        expected: 'Create a `notes/` directory for detailed knowledge files',
        prompt: 'full',
    },
    {
        capability: 'proactive note updates',
        expected: '**Update notes proactively**',
        prompt: 'full',
    },
    {
        capability: 'compaction safety',
        expected: 'MEMORY.md must be self-sufficient as a recovery point',
        prompt: 'full',
    },
    {
        capability: 'active-context note before long tasks',
        expected: 'write a brief "Active Context" note',
        prompt: 'full',
    },
    {
        capability: 'unconfined computer access',
        expected: 'not confined to any directory',
        prompt: 'full',
    },
    {
        capability: 'role evolution',
        expected: 'develop a specialized role over time',
        prompt: 'full',
    },
    // Outputs and visuals.
    {
        capability: 'fences ride send bodies',
        expected: 'directly in the body of a `grotto message send`',
        prompt: 'full',
    },
    { capability: 'workspace links', expected: 'grotto://workspace/path', prompt: 'full' },
    {
        capability: 'artifact click-to-open, no auto-open',
        expected: 'nothing auto-opens',
        prompt: 'full',
    },
    {
        capability: 'rendering surfaces named (visuals, artifacts)',
        expected: 'render inline visuals (bespoke HTML/SVG) and artifact pages',
        prompt: 'full',
    },
    {
        capability: 'visuals skill is a mandatory pre-fence read',
        expected: 'Before emitting any visual or artifact fence, read the visuals skill',
        prompt: 'full',
    },
    {
        capability: 'HTML ban in plain message text',
        expected: 'Never output HTML, JSX, CSS, imports, or class names in plain message text.',
        prompt: 'full',
    },
    // Web capability and notifications.
    {
        capability: 'web access taught when enabled',
        expected: 'Web access is on: fetch pages with web_fetch',
        prompt: 'full',
    },
    {
        capability: 'web citation rule',
        expected: 'Cite source URLs for claims taken from the web.',
        prompt: 'full',
    },
    {
        absent: true,
        capability: 'no model-specific steering',
        expected: '## Tool-Use Enforcement',
        prompt: 'full',
    },
    {
        absent: true,
        capability: 'no model-specific execution discipline',
        expected: '## Execution Discipline',
        prompt: 'full',
    },
    {
        capability: 'searchless model told plainly',
        expected: 'Your current model has no web search tool',
        prompt: 'full',
    },
    {
        capability: 'notices are content-free',
        expected: 'it does not include the message content',
        prompt: 'full',
    },
    {
        capability: 'inbox check for pending targets',
        expected: 'call `grotto inbox check`',
        prompt: 'full',
    },
    { capability: 'pivot on higher priority', expected: 'pivot to it', prompt: 'full' },
    // Absence requirements — the enforced dead list.
    { absent: true, capability: 'no NO_REPLY', expected: 'NO_REPLY', prompt: 'full' },
    { absent: true, capability: 'no chat tools', expected: 'chat_send', prompt: 'full' },
    {
        absent: true,
        capability: 'no chat message tools',
        expected: 'chat_messages_list',
        prompt: 'full',
    },
    { absent: true, capability: 'no wait-idle tool', expected: 'chat_wait_idle', prompt: 'full' },
    { absent: true, capability: 'no wiki', expected: 'wiki_', prompt: 'full' },
    { absent: true, capability: 'no cron tools', expected: 'cron_', prompt: 'full' },
    {
        absent: true,
        capability: 'no automations section',
        expected: '## Automations',
        prompt: 'full',
    },
    { absent: true, capability: 'no pane_open', expected: 'pane_open', prompt: 'full' },
    { absent: true, capability: 'no skills tools', expected: 'skills_list', prompt: 'full' },
    { absent: true, capability: 'no task tools', expected: 'tasks_list', prompt: 'full' },
    { absent: true, capability: 'no USER.md surface', expected: 'USER.md', prompt: 'full' },
    // MEMORY.md (the filename) appears legitimately throughout; the absence
    // target is the injected section header, matched anchored.
    {
        absent: true,
        capability: 'no injected memory section',
        expected: /^## MEMORY$/mu,
        prompt: 'full',
    },
    { absent: true, capability: 'no SOUL section', expected: '## SOUL', prompt: 'full' },
    { absent: true, capability: 'no NOTES.md surface', expected: 'NOTES.md', prompt: 'full' },
    { absent: true, capability: 'no widget fences', expected: 'widget:', prompt: 'full' },
    { absent: true, capability: 'no workbench teaching', expected: 'workbench', prompt: 'full' },
    { absent: true, capability: 'no wiki links', expected: 'grotto://wiki', prompt: 'full' },
    {
        absent: true,
        capability: 'no evaluation framing',
        expected: 'choose whether to speak',
        prompt: 'full',
    },
    {
        absent: true,
        capability: 'no web teaching when off',
        expected: 'web_fetch',
        prompt: 'minimal',
    },
    {
        absent: true,
        capability: 'no integration-specific teaching',
        expected: 'MerchBase',
        prompt: 'full',
    },
    {
        absent: true,
        capability: 'no retired integration tools',
        expected: 'merchbase_sales_series',
        prompt: 'full',
    },
];

/**
 * Skill-side contract for the seeded visuals skill (PRD-86): capabilities the
 * prompt used to carry now live in SKILL.md and its references. Same rules as
 * REQUIREMENTS — never delete or weaken an entry to make the suite pass.
 */
const VISUALS_SKILL_REQUIREMENTS: Array<{
    capability: string;
    expected: RegExp | string;
    file: 'SKILL.md' | 'references/design-system.md' | 'references/icons.md';
}> = [
    // Fence contracts (moved from the prompt's Visuals/Widgets sections).
    // The widget catalog requirements were removed 2026-07-20 with the
    // catalog itself (operator-directed: the visual spec is the only
    // rendering surface).
    { capability: 'visual fence taught', expected: '```visual Weekly sales', file: 'SKILL.md' },
    {
        capability: 'artifact fence JSON contract',
        expected: 'containing exactly one JSON object',
        file: 'SKILL.md',
    },
    {
        capability: 'markdown tables replaced by plain HTML tables',
        expected: 'Render tabular data as a plain HTML `<table>`',
        file: 'SKILL.md',
    },
    {
        capability: 'artifact tier taught',
        expected: 'opened in the artifact pane, for anything the user will keep or iterate on',
        file: 'SKILL.md',
    },
    {
        capability: 'visual vs artifact ladder taught',
        expected: /Build an \*\*artifact\*\*\s+for\s+deliverables/u,
        file: 'SKILL.md',
    },
    {
        capability: 'visuals are self-contained snapshots',
        expected: 'Embed all\n  data inline at generation time.',
        file: 'SKILL.md',
    },
    {
        capability: 'proactive rendering taught',
        expected: 'proactive visuals are expected when the structure is there',
        file: 'SKILL.md',
    },
    {
        capability: 'design system is a mandatory read',
        expected: 'you MUST read',
        file: 'SKILL.md',
    },
    {
        capability: 'token discipline: no hardcoded colors',
        expected: 'Never hardcode colors, fonts, or radii',
        file: 'SKILL.md',
    },
    // Design system (the taste layer the battery tunes).
    {
        capability: 'Chart.js pin matches the renderer CSP',
        expected: 'chart.js@4.5.1',
        file: 'references/design-system.md',
    },
    {
        capability: 'categorical series order taught',
        expected:
            '`--chart-1`\n  (blue) → `--chart-2` (red) → `--chart-3` (green) → `--chart-4` (purple) →\n  `--chart-5` (neutral gray)',
        file: 'references/design-system.md',
    },
    {
        capability: 'text never wears the series color',
        expected: 'Text never wears the series color',
        file: 'references/design-system.md',
    },
    {
        capability: 'two-weight typography rule',
        expected: '**Two weights only**: 400 regular and 500 bold.',
        file: 'references/design-system.md',
    },
    {
        capability: 'sentence case rule',
        expected: '**Sentence case always**',
        file: 'references/design-system.md',
    },
    {
        capability: 'spacing scale taught',
        expected: '4 / 8 / 12 / 16 / 20 / 24 / 32',
        file: 'references/design-system.md',
    },
    {
        capability: 'streaming authoring order taught',
        expected: '`<script>` last for interactivity',
        file: 'references/design-system.md',
    },
    {
        capability: 'pages own their background',
        expected: 'Pages own their ground: `background: var(--background)`',
        file: 'references/design-system.md',
    },
    {
        capability: 'native table styling taught',
        expected: 'the visual frame styles\nbare tables natively',
        file: 'references/design-system.md',
    },
    {
        capability: 'text fitting calibration taught',
        expected: 'Budget per character',
        file: 'references/design-system.md',
    },
    {
        capability: 'viewBox safety checklist taught',
        expected: 'viewBox safety checklist',
        file: 'references/design-system.md',
    },
    // Icons.
    {
        capability: 'emoji ban for UI icons',
        expected: 'Do not use emoji as UI icons.',
        file: 'references/icons.md',
    },
    {
        capability: 'icon size ceiling',
        expected: '24px is the hard ceiling',
        file: 'references/icons.md',
    },
];

// Character ceilings sliced from the end-state render (families 5–9 open,
// per ws2-requirements-plan.md "Budgets"). channelTotal 32,500 is the
// operator-ruled flip budget (supersedes D7's 28k after the Raft
// prompt-length audit); raising any number is a deliberate spend decision —
// confirm with the operator.
const promptBudgets = {
    capabilities: 300,
    channelTotal: 32_500,
    cliContract: 3300,
    identityAndContext: 1200,
    initialRole: 200,
    mentionsAndStyle: 3600,
    messaging: 14_500,
    outputsVisuals: 900,
    webNotifications: 1800,
    startupAndTurns: 1800,
    workspaceMemory: 4200,
};

const contractRuntimeContext = {
    hostname: 'contract-host',
    os: 'ContractOS 1.0',
    runtimeVersion: '0.0.0-contract',
};

describe('agent prompt contract', () => {
    let skillsDir: string;
    let workspaceDir: string;

    beforeEach(async () => {
        skillsDir = await mkdtemp(path.join(tmpdir(), 'tavern-prompt-skills-'));
        workspaceDir = await mkdtemp(path.join(tmpdir(), 'tavern-prompt-workspace-'));
        ensureRuntimeSchema(initTestDb());
        upsertStoredAgent({ agent: executorInput('full', workspaceDir).agent });
        // Pin the home timezone so snapshots never depend on the host machine.
        await handleTimezoneSettingsRequest(
            new Request(`http://runtime.test${agentRuntimeRoutes.timezoneSettings}`, {
                body: JSON.stringify({ timezone: 'UTC' }),
                headers: {
                    'content-type': 'application/json',
                    [agentRuntimeMutationHeaders.origin]: agentRuntimeMutationOrigins.tavern,
                },
                method: 'PUT',
            })
        );
    });

    afterEach(async () => {
        closeDb();
        await Promise.all([
            rm(skillsDir, { force: true, recursive: true }),
            rm(workspaceDir, { force: true, recursive: true }),
        ]);
    });

    it('keeps every prompt-taught capability present', async () => {
        const prompts = {
            full: await renderPrompt('full'),
            minimal: await renderPrompt('minimal'),
        };

        const failures = REQUIREMENTS.filter((requirement) => {
            const present = matches(prompts[requirement.prompt], requirement.expected);
            return requirement.absent ? present : !present;
        }).map((requirement) => requirement.capability);

        expect(failures, 'Prompt lost capabilities — see PROMPT CONTRACT header').toEqual([]);
    });

    it('keeps every skill-taught visuals capability present', () => {
        const sources = {
            'SKILL.md': defaultVisualsSkill,
            'references/design-system.md': visualsSkillFiles['references/design-system.md'] ?? '',
            'references/icons.md': visualsSkillFiles['references/icons.md'] ?? '',
        };

        const missing = VISUALS_SKILL_REQUIREMENTS.filter((requirement) => {
            const source = sources[requirement.file];
            return !matches(source, requirement.expected);
        }).map((requirement) => requirement.capability);

        expect(missing, 'Visuals skill lost capabilities — see PROMPT CONTRACT header').toEqual([]);
    });

    it('matches the reviewed full prompt snapshot', async () => {
        const prompt = normalize(await renderPrompt('full'), workspaceDir);
        const snapshot = await readFile(
            new URL('./__prompt-snapshots__/full-prompt.md', import.meta.url),
            'utf8'
        );
        expect(prompt).toBe(snapshot);
    });

    it('matches the reviewed minimal prompt snapshot', async () => {
        const prompt = normalize(await renderPrompt('minimal'), workspaceDir);
        const snapshot = await readFile(
            new URL('./__prompt-snapshots__/minimal-prompt.md', import.meta.url),
            'utf8'
        );
        expect(prompt).toBe(snapshot);
    });

    it('stays inside the prompt character budgets', async () => {
        const prompt = await renderPrompt('full');
        const slice = (from: string, to: string | null) => {
            const start = prompt.indexOf(from);
            expect(start, `budget slice start "${from}"`).toBeGreaterThan(-1);
            const end = to ? prompt.indexOf(to) : prompt.length;
            expect(end, `budget slice end "${to}"`).toBeGreaterThan(start);
            return prompt.slice(start, end).length;
        };

        expect(slice('You are "', '## Communication — grotto CLI ONLY')).toBeLessThanOrEqual(
            promptBudgets.identityAndContext
        );
        expect(
            slice('## Communication — grotto CLI ONLY', '## Startup sequence')
        ).toBeLessThanOrEqual(promptBudgets.cliContract);
        expect(slice('## Startup sequence', '## Messaging')).toBeLessThanOrEqual(
            promptBudgets.startupAndTurns
        );
        expect(slice('## Messaging', '## @Mentions')).toBeLessThanOrEqual(promptBudgets.messaging);
        expect(slice('## @Mentions', '## Workspace & Memory')).toBeLessThanOrEqual(
            promptBudgets.mentionsAndStyle
        );
        expect(slice('## Workspace & Memory', '## Capabilities')).toBeLessThanOrEqual(
            promptBudgets.workspaceMemory
        );
        expect(slice('## Capabilities', '## Outputs')).toBeLessThanOrEqual(
            promptBudgets.capabilities
        );
        expect(slice('## Outputs', '## Web access')).toBeLessThanOrEqual(
            promptBudgets.outputsVisuals
        );
        expect(slice('## Web access', '## Initial role')).toBeLessThanOrEqual(
            promptBudgets.webNotifications
        );
        expect(slice('## Initial role', null)).toBeLessThanOrEqual(promptBudgets.initialRole);
        expect(prompt.length).toBeLessThanOrEqual(promptBudgets.channelTotal);
    });

    // The snapshots cover the searchless variant (the full fixture runs an
    // API-key model); search-capable sessions must be told they can search.
    it('teaches the web search tool on search-capable models', async () => {
        const input = executorInput('full', workspaceDir);
        input.agentSession.effectiveModel = { model: 'gpt-5.5', provider: 'codex' };
        const prompt = await buildAgentInstructions(input, {
            db: getDb(),
            runtimeContext: contractRuntimeContext,
            skillsDir,
        });

        expect(prompt).toContain('search the live web with your web search tool');
        expect(prompt).not.toContain('Your current model has no web search tool');
    });

    it.each([
        { model: 'gpt-5.5', provider: 'codex' },
        { model: 'gemini-2.5-pro', provider: 'google' },
        { model: 'claude-opus-4-8', provider: 'claude' },
    ])('does not add model-family instructions for $model', async (effectiveModel) => {
        const input = executorInput('full', workspaceDir);
        input.agentSession.effectiveModel = effectiveModel;
        const prompt = await buildAgentInstructions(input, {
            db: getDb(),
            runtimeContext: contractRuntimeContext,
            skillsDir,
        });

        expect(prompt).not.toContain('## Tool-Use Enforcement');
        expect(prompt).not.toContain('## Execution Discipline');
        expect(prompt).not.toContain('## Operational Directives');
        expect(prompt.trimEnd().endsWith('This may evolve.')).toBe(true);
    });

    async function renderPrompt(fixture: 'full' | 'minimal') {
        return await buildAgentInstructions(executorInput(fixture, workspaceDir), {
            db: getDb(),
            runtimeContext: contractRuntimeContext,
            skillsDir,
        });
    }
});

function matches(source: string, expected: RegExp | string) {
    return typeof expected === 'string' ? source.includes(expected) : expected.test(source);
}

function normalize(prompt: string, workspaceDir: string) {
    return `${prompt.replaceAll(workspaceDir, '<workspace>').trimEnd()}\n`;
}

// Fixtures (ws2-requirements-plan.md): `full` proves the web-enabled,
// gpt-family, plugin-free render; `minimal` proves the absence rules with
// web access off. One global session spans every chat (ADR 0011), so chat
// kind never changes composition — there is no per-chat fixture.
function executorInput(fixture: 'full' | 'minimal', workspaceFolder: string): AgentExecutorInput {
    const now = '2026-06-29T12:00:00.000Z';
    return {
        agent: {
            ...(fixture === 'full' ? { bio: 'Runs the contract fixtures desk.' } : {}),
            enabledSkillIds: [],
            id: 'agt_primary',
            isAdmin: true,
            name: 'Otto',
            primaryColor: null,
            webAccessEnabled: fixture === 'full',
            workspaceFolder,
        },
        agentSession: {
            agentId: 'agt_primary',
            archivedAt: null,
            createdAt: now,
            effectiveModel: { model: 'gpt-4.1-mini', provider: 'openai' },
            generation: 1,
            id: 'ags_agt_primary_1',
            lastTurnAt: null,
            resumeState: null,
            runtimeSessionId: null,
            status: 'active',
            updatedAt: now,
        },
        prompt: 'contract fixture',
        runId: 'run_contract',
    };
}
