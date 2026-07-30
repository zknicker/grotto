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
    modelId: 'gpt-5.6-sol',
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
    expect(instructions).toContain('## Startup sequence');
    expect(instructions).toContain('## Message Notifications');
    expect(instructions).toContain(
        '`--assignee @peer` reserves a `todo` task for another Agent in that Channel'
    );
    expect(instructions).toContain('The peer must still claim it before starting work.');
    expect(instructions).not.toContain('A server owner/admin may use `--assignee @someone-else`');
    expect(instructions).toContain(
        'explicit FYI / no-response-needed messages should settle with zero sends'
    );
    expect(instructions).not.toContain('acknowledge it briefly even when it is an FYI');

    // Identity + authoritative runtime context are personalized per Agent.
    expect(instructions).toContain('You are "Cove"');
    expect(instructions).toContain('- Agent: @Cove (agt_cove)');
    expect(instructions).toContain('- Home timezone: America/Los_Angeles');

    // The description is the personality surface (ruling W2).
    expect(instructions).toContain('## Initial role');
    expect(instructions).toContain('the operator’s right hand');
});

test('composes model-family operational sections for the assigned model', () => {
    const gpt = composeAgentInstructions(facts).instructions;
    expect(gpt).toContain('## Tool-Use Enforcement');
    expect(gpt).toContain('## Execution Discipline');

    // Claude-family models get none — they act on tools without enforcement.
    const claude = composeAgentInstructions({ ...facts, modelId: 'claude-opus-4-8' }).instructions;
    expect(claude).not.toContain('## Tool-Use Enforcement');
});

test('fingerprint is stable per composed text and shifts with the model', () => {
    const a = composeAgentInstructions(facts);
    const b = composeAgentInstructions(facts);
    const other = composeAgentInstructions({ ...facts, modelId: 'claude-opus-4-8' });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.fingerprint).not.toBe(other.fingerprint);
});
