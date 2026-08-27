import { expect, test } from 'bun:test';
import { composeAgentInstructions } from './instructions.ts';

// The smallest guard on the ported system prompt: every real Computer Agent must
// receive the CLI-only Grotto collaboration contract at cold start. These assert
// the load-bearing message-check / message-send / CLI-only requirements, not the
// whole (operator-approved) template.

const facts = {
    agentId: 'agt_cove',
    agentName: 'Cove',
    homeTimezone: 'America/Los_Angeles',
    initialRole: 'the operator’s right hand',
    webAccess: null,
    workspacePath: '/home/agt_cove/workspace',
} as const;

test('composes the CLI-only Grotto collaboration contract', () => {
    const { instructions } = composeAgentInstructions(facts);

    // CLI-only output is the load-bearing rule (D1/ADR 0014).
    expect(instructions).toContain('## Communication — grotto CLI ONLY');
    expect(instructions).toContain(
        'This is your only output channel: text you produce outside a `grotto` command is not delivered to anyone.'
    );

    // The critical message verbs the Agent needs to receive and reply.
    expect(instructions).toContain('grotto message check');
    expect(instructions).toContain('grotto message send');
    expect(instructions).toContain('grotto action prepare');
    expect(instructions).toContain('grotto avatar generate');
    expect(instructions).toContain(
        '**Manual** — `grotto manual get`, `grotto manual search`. Both require `--intent`'
    );
    expect(instructions).toContain('## Startup sequence');
    expect(instructions).toContain('## Message Notifications');
    expect(instructions).toContain(
        '`--assignee @peer` reserves a `todo` task for another Agent in that Channel'
    );
    expect(instructions).toContain(
        'The assignee receives an assignment receipt pointing to the canonical task; inspect and claim that task before working.'
    );
    // Owners and Admins reserve tasks for Agents from the App, so the prompt has
    // to teach that a receipt can arrive from a human, not only from a peer.
    expect(instructions).toContain('Owners and Admins do the same from the App.');
    expect(instructions).toContain(
        'A later direct @mention reactivates that follow and repeats the exact unfollow command in the Agent delivery.'
    );
    expect(instructions).not.toContain('A server owner/admin may use `--assignee @someone-else`');
    expect(instructions).toContain('An assignee-only receipt that names you is actionable');
    expect(instructions).toContain(
        'A failed claim is a concurrency lock, not a ruling on lane ownership'
    );
    expect(instructions).toContain('correct the routing in the original thread');
    expect(instructions).toContain('Default every message to the shortest useful form');
    expect(instructions).toContain('Do not paste execution logs into chat');
    expect(instructions).toContain('A completion message should lead with the outcome');
    expect(instructions).toContain(
        'Fresh-read it immediately before acting — or continuing to withhold — (Grotto: current message/task; PR: current repo/PR)'
    );
    expect(instructions).toContain('checks on the exact head');
    expect(instructions).toContain(
        'explicit FYI / no-response-needed messages should settle with zero sends'
    );
    expect(instructions).toContain(
        'use every relevant durable user preference as an execution constraint'
    );
    expect(instructions).not.toContain('acknowledge it briefly even when it is an FYI');

    // Durable scheduling belongs to Grotto reminders, not sleeps, memory, or
    // runtime-native schedulers. Fires wake only the author.
    expect(instructions).toContain(
        'Use reminders for follow-up that depends on future state you cannot resolve now, whether user-requested or self-driven.'
    );
    expect(instructions).toContain(
        'when it fires, it wakes the author who scheduled it, not other people'
    );
    expect(instructions).toContain(
        'Use reminders instead of keeping the current turn alive with a long sleep or relying on MEMORY to wake you.'
    );
    expect(instructions).toContain(
        'Use `grotto reminder schedule` rather than runtime-native wake or cron tools'
    );
    expect(instructions).toContain(
        'When a reminder already exists, prefer `grotto reminder snooze` to push it later, `grotto reminder update` to change its meaning or schedule'
    );

    // Identity + authoritative runtime context are personalized per Agent.
    expect(instructions).toContain('You are "Cove"');
    expect(instructions).toContain('- Agent: @Cove (agt_cove)');
    expect(instructions).toContain('- Home timezone: America/Los_Angeles');

    // The description is the personality surface (ruling W2).
    expect(instructions).toContain('## Initial role');
    expect(instructions).toContain('the operator’s right hand');
});

test('advertises action capabilities without inventing an Agent-creation policy', () => {
    const { instructions } = composeAgentInstructions(facts);

    expect(instructions).toContain('**Action cards** — `grotto action prepare`.');
    expect(instructions).toContain('**Avatar generation** — `grotto avatar generate`.');
    expect(instructions).not.toContain('recipes/playbook/agent-creation');
    expect(instructions).not.toContain('### Preparing native action cards');
    expect(instructions).not.toMatch(/playful character|fun name|exactly one generation/iu);
});

test('does not append retired model-family operational instructions', () => {
    const { instructions } = composeAgentInstructions(facts);

    expect(instructions).not.toContain('## Tool-Use Enforcement');
    expect(instructions).not.toContain('## Execution Discipline');
    expect(instructions).not.toContain('## Operational Directives');
});

test('fingerprint is stable per composed text', () => {
    const a = composeAgentInstructions(facts);
    const b = composeAgentInstructions(facts);
    expect(a.fingerprint).toBe(b.fingerprint);
});
