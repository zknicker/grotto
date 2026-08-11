import { expect, test } from 'bun:test';
import { renderAgentInstructions } from './managed-instructions.ts';

test('the hosted Agent prompt preserves the notice-to-pull contract', () => {
    const prompt = renderAgentInstructions({
        agentId: 'agt_prompt_test',
        agentName: 'Cove',
        homeTimezone: 'UTC',
        hostname: 'computer.test',
        initialRole: null,
        os: 'macOS',
        runtimeVersion: 'test',
        webAccess: null,
        workspacePath: '/workbench',
    });

    expect(prompt).toContain('The notice is not itself a request');
    expect(prompt).toContain('`grotto message check` reads locally cached bodies');
    expect(prompt).toContain('Deferral needs no visible reply');
    expect(prompt).toContain('Your process stays alive across turns');
});
