// Importing a host skill changes what the Agent can do on its very next turn.
// The gates are the durable capability change the Computer reports plus the
// skill's own required output headings, which the model cannot invent by luck.

import { defineScenario } from '../scenario.mjs';

const skillName = 'decision-helper';
const requiredHeadings = [
    '## Decision',
    '## Options',
    '## Decision Matrix',
    '## Recommendation',
    '## Next Steps',
];

export default defineScenario({
    agents: [{ kind: 'worker' }],
    contract:
        'A skill imported to one Agent lands as Computer-reported Agent skill state and shapes the next turn: the reply follows every heading the skill requires and carries the requested marker.',
    name: 'skill-import-shapes-turn',
    async run({ agents, expect, kit, log, marker, settleTurn }) {
        const [worker] = agents;
        const token = marker('DECIDE');
        expect(worker.dmChatId, 'worker Owner DM').toBeTruthy();

        log('importing the skill');
        const source = await findSkillSource(kit, worker.computerId);
        expect(source?.id, `${skillName} importable source`).toBeTruthy();

        const accepted = await kit.trpc('agent.importSkill', {
            agentId: worker.id,
            serverId: kit.serverId,
            sourceId: source.id,
        });
        expect(accepted.status, 'skill import status').toBe('accepted');

        const reported = await waitForImportedSkill(kit, worker);
        expect(
            reported.map((skill) => skill.name),
            'Computer-reported Agent skills'
        ).toContain(skillName);

        log('asking for a skill-shaped decision');
        const head = await kit.readHead(worker.dmChatId);
        await kit.harness.send(
            worker.dmChatId,
            `Use $${skillName} to compare a staged launch with a big-bang launch. Follow the skill's required output headings and include the marker ${token} under Decision.`
        );

        const turn = await settleTurn(worker.id);
        expect(turn.status, 'turn status').toBe('completed');
        expect(turn.failureKind ?? 'none', 'turn failure kind').toBe('none');
        expect(turn.outputProduced, 'turn produced durable output').toBe(true);

        log('checking gates');
        const replies = await agentReplies(kit, worker.id, worker.dmChatId, head);
        for (const heading of requiredHeadings) {
            expect(replies, `skill heading ${heading}`).toContain(heading);
        }
        expect(replies, 'the requested marker').toContain(token);
    },
});

async function findSkillSource(kit, computerId) {
    const computers = await kit.trpc('computer.list', { serverId: kit.serverId });
    const computer = computers.find((candidate) => candidate.id === computerId);
    return (computer?.reportedInventory?.importableSkills ?? []).find(
        (skill) => skill.name.toLowerCase() === skillName
    );
}

/** The Computer writes the skill, then reports it back in its inventory. */
async function waitForImportedSkill(kit, worker) {
    const deadline = Date.now() + 120_000;
    let reported = [];
    for (;;) {
        const computers = await kit.trpc('computer.list', { serverId: kit.serverId });
        const computer = computers.find((candidate) => candidate.id === worker.computerId);
        reported =
            (computer?.reportedInventory?.agentSkills ?? []).find(
                (entry) => entry.agentId === worker.id
            )?.skills ?? [];
        if (reported.some((skill) => skill.name.toLowerCase() === skillName)) {
            return reported;
        }
        if (Date.now() >= deadline) {
            return reported;
        }
        await wait(2000);
    }
}

/** Agent replies in the Owner DM, including any Thread the Agent opened there. */
async function agentReplies(kit, agentId, chatId, sinceSequence) {
    const page = await kit.trpc('chat.messages', { chatId, limit: 100, serverId: kit.serverId });
    const collected = kit.authoredBy(page.messages, agentId, sinceSequence);
    for (const thread of page.threads ?? []) {
        const messages = await kit.readMessages(thread.threadChatId);
        collected.push(...kit.authoredBy(messages, agentId));
    }
    return collected;
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
