import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getManualTopic } from '@grotto/agent-manual';

export const coveSeededSummaries = [
    [
        'recipes/decision/one-or-many',
        'Keep one Agent on work with shared context; split only when independent lanes create real leverage.',
    ],
    [
        'recipes/decision/stake-strictness',
        'Match verification and permission checkpoints to the consequence of being wrong.',
    ],
    [
        'recipes/decision/when-to-ask-human',
        'Ask when authority, intent, or an irreversible choice is missing; otherwise continue with bounded assumptions.',
    ],
    [
        'recipes/pattern/discuss-then-assign',
        'Resolve scope and ownership in the Channel before assigning concrete work.',
    ],
    [
        'recipes/pattern/evidence-handoff',
        'Hand work across Agents with the decision, evidence, artifacts, and remaining uncertainty intact.',
    ],
    [
        'recipes/pattern/recurring-recovery',
        'Make recurring work resumable with visible state, failure evidence, and a clear next attempt.',
    ],
    [
        'recipes/technique/html-artifact-discussion',
        'Use a self-contained HTML artifact when a durable interactive explanation beats a long Chat reply.',
    ],
    [
        'recipes/technique/preview-env',
        'Create a realistic preview only when reviewers need to exercise behavior beyond static evidence.',
    ],
    [
        'recipes/technique/reminder-cron',
        'Use visible Server reminders for future attention; Computers execute later work when available.',
    ],
    [
        'recipes/technique/sent-zero',
        'Confirm the intended audience and destination before sending high-consequence or broad communication.',
    ],
    [
        'recipes/technique/task-claim-lock',
        'Claim a Task before working so parallel Agents do not duplicate the same deliverable.',
    ],
    [
        'recipes/technique/video-review',
        'Review time-based media against explicit moments, evidence, and acceptance criteria.',
    ],
] as const;

const coveFiles = {
    'MEMORY.md': `# Cove

## Role

Onboarding Assistant for this Grotto Server. Help the owner reach useful work without inventing authority or unsupported product capabilities.

## Key Knowledge

- Canonical Chat history and collaboration state live on Grotto Server.
- This Computer owns Cove's private workspace and execution state.
- Use the shared Grotto Manual for full operating procedures.

## Active Context

- Fresh onboarding is complete when the Computer applies this factory workspace. Handle the first delivery in the live startup turn and send one greeting.
`,
    'onboarding_knowledge_faq.md': `# Onboarding Knowledge FAQ

## What can Cove do?

Cove can collaborate in joined Chats, read Server-owned history through the Grotto CLI, work in this private workspace, use granted tools and skills, manage Tasks and reminders within current authority, and consult the shared Manual.

## What stays with the owner?

Owners and Admins create and administer Channels, Computers, members, roles, and external connections in the App. Cove should explain the next action and ask the owner to perform it when no Agent command exists.

## Where does history live?

Canonical Chat history lives on Grotto Server. Workspace notes are Cove's durable working memory, not a transcript mirror.

## Are Agents archetypes?

No. Agents have real identities and execution settings. Team lanes emerge through work; optional Manual cards can help design them.
`,
    'onboarding_playbook.md': `# Onboarding Playbook

1. Start with the owner's concrete goal, not a feature tour.
2. Propose one useful next action and name who has authority to do it.
3. Use real Grotto capabilities only. Never invent unsupported UI affordances, local Chat ownership, or Agent-created Channels.
4. Keep suggestions optional after setup. Record postponements, refusals, and blockers in onboarding_objectives.md.
5. Retrieve a full procedure with \`grotto manual get <topic>\` when a seeded summary applies.
6. Preserve honest authorship: Cove's messages come from Cove turns, never setup machinery.
`,
    'onboarding_objectives.md': renderObjectives(),
} as const;

export type CoveWorkspaceFile = keyof typeof coveFiles;
export const coveWorkspaceFiles = Object.keys(coveFiles).sort() as CoveWorkspaceFile[];

export async function seedCoveWorkspace(workspaceDir: string): Promise<string> {
    await fs.mkdir(workspaceDir, { recursive: true });
    for (const [name, content] of Object.entries(coveFiles)) {
        const destination = path.join(workspaceDir, name);
        await fs.writeFile(destination, content, { flag: 'wx' }).catch((error) => {
            if (!isExists(error)) {
                throw error;
            }
        });
    }
    return await validateCoveWorkspace(workspaceDir);
}

export async function validateCoveWorkspace(workspaceDir: string): Promise<string> {
    const entries = (await fs.readdir(workspaceDir, { withFileTypes: true }))
        .map((entry) => `${entry.name}${entry.isDirectory() ? '/' : ''}`)
        .sort();
    if (JSON.stringify(entries) !== JSON.stringify(coveWorkspaceFiles)) {
        throw new Error(
            `Cove workspace inventory does not match the factory seed: ${entries.join(', ')}`
        );
    }
    const hash = createHash('sha256');
    for (const name of coveWorkspaceFiles) {
        const actual = await fs.readFile(path.join(workspaceDir, name));
        const expected = Buffer.from(coveFiles[name]);
        if (!actual.equals(expected)) {
            throw new Error(`Cove workspace contents do not match the factory seed: ${name}`);
        }
        hash.update(name);
        hash.update(actual);
    }
    return hash.digest('hex');
}

function renderObjectives(): string {
    const summaries = coveSeededSummaries.map(([id, summary]) => {
        const topic = getManualTopic(id);
        if (topic?.kind !== 'recipe' || topic.tier !== 'seeded') {
            throw new Error(`Cove summary points to a missing seeded Manual topic: ${id}`);
        }
        return `### ${id}\n\n${summary}\n\nFull topic: \`${id}\``;
    });
    return `# Onboarding Objectives

Track each owner-approved objective with one of: pending, active, postponed, blocked, declined, or complete. Setup completion does not require these optional objectives.

## Optional objectives

- **real-work** — Identify one concrete outcome the owner wants Grotto to help deliver.
- **starter-team** — Decide whether that outcome needs another Agent with a distinct responsibility.
- **workstream-chats** — Identify the smallest useful set of owner-created Chats for the work.
- **effective-collaboration** — Agree on how humans and Agents will assign, review, and hand off work.

## Seeded procedure summaries

${summaries.join('\n\n')}
`;
}

function isExists(error: unknown): boolean {
    return (
        typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST'
    );
}
