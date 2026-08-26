import { expect, test } from 'bun:test';
import { renderAgentInstructions } from './managed-instructions.ts';

test('the Agent prompt preserves the notice-to-pull contract', () => {
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

test('replies keep the received target while Task updates use the Task Thread', () => {
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

    expect(prompt).toContain(
        'To reply to any message, always reuse the exact `target` from the received message.'
    );
    expect(prompt).toContain("Post updates in the task's thread:");
    expect(prompt).not.toContain('Deliver the final result there unless');
});

test('teaches Raft-aligned claim conflicts, assignment receipts, and message quality', () => {
    const prompt = renderAgentInstructions({
        agentId: 'agt_prompt_test',
        agentName: 'Cove',
        homeTimezone: 'UTC',
        initialRole: null,
        os: 'macOS',
        runtimeVersion: 'test',
        webAccess: null,
        hostname: 'computer.test',
        workspacePath: '/workbench',
    });

    expect(prompt).toContain(
        'A failed claim is a concurrency lock, not a ruling on lane ownership'
    );
    expect(prompt).toContain('correct the routing in the original thread');
    expect(prompt).toContain('An assignee-only receipt that names you is actionable');
    expect(prompt).toContain('It is context, not a second task');
    expect(prompt).toContain(
        'run `grotto message read --target "#channel:shortid"` before replying'
    );
    expect(prompt).toContain('Default every message to the shortest useful form');
    expect(prompt).toContain('Do not paste execution logs into chat');
    expect(prompt).toContain('A completion message should lead with the outcome');
    expect(prompt).toContain(
        'Fresh-read it immediately before acting — or continuing to withhold — (Grotto: current message/task; PR: current repo/PR)'
    );
    expect(prompt).toContain('checks on the exact head');
    expect(prompt).toContain(
        'To mute ordinary Activity delivery from a regular channel itself without leaving'
    );
    expect(prompt).toContain('and threads you follow keep delivering independently');
    expect(prompt).toContain(
        'A parent channel mute does not suppress ordinary delivery from threads you follow'
    );
    expect(prompt).not.toContain(
        'A parent channel mute already suppresses ordinary delivery from its threads'
    );

    // These Raft-only surfaces must not leak into the Grotto prompt.
    expect(prompt).not.toContain('reviewer-isolation');
    expect(prompt).not.toContain('raft wiki');
});

test('keeps the managed prompt within its reviewed size budget', () => {
    const prompt = renderAgentInstructions({
        agentId: 'agt_prompt_test',
        agentName: 'Cove',
        homeTimezone: 'America/Los_Angeles',
        initialRole: 'the operator’s right hand',
        os: 'macOS',
        runtimeVersion: 'test',
        webAccess: 'search',
        hostname: 'computer.test',
        workspacePath: '/workbench',
    });

    // The native action-card command is part of the managed prompt contract.
    expect(prompt.length).toBeLessThanOrEqual(33_500);
});
