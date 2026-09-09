import { expect, test } from 'bun:test';
import { renderAgentInstructions } from './managed-instructions.ts';

const efficiencyPrompt = renderAgentInstructions({
    agentId: 'agt_efficiency',
    agentName: 'Marlow',
    homeTimezone: 'America/New_York',
    hostname: 'computer.test',
    initialRole: null,
    os: 'macOS',
    runtimeVersion: 'test',
    webAccess: null,
    workspacePath: '/workspace',
});

test('each turn reads current memory while compaction recovery remains required', () => {
    expect(efficiencyPrompt).toContain(
        '2. Read MEMORY.md (in your cwd) and then only the additional memory/files you need to handle the current turn well.'
    );
    expect(efficiencyPrompt).toContain('including after context compression');
    expect(efficiencyPrompt).toContain(
        'Your session resets rarely, so reading it only at startup is not enough.'
    );
    expect(efficiencyPrompt).not.toContain('skip routine follow-up rereads');
});

test('an explicitly requested unavailable MCP does not trigger local configuration searches', () => {
    expect(efficiencyPrompt).toContain(
        'For an explicitly requested MCP, use the current injected tool inventory'
    );
    expect(efficiencyPrompt).toContain(
        'Local configuration, environment, and filesystem searches cannot establish a Server MCP grant'
    );
    expect(efficiencyPrompt).toContain('Absence from one inventory does not establish');
    expect(efficiencyPrompt).toContain(
        "The human's explicit choice of surface is part of that fit."
    );
});

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

    // Raft parity (startup step 3, Computer 1.0.16): the honest-deferral clause
    // and the stay-alive delivery sentence are load-bearing, not decoration.
    expect(prompt).toContain('their bodies are withheld to avoid flooding you, not absent');
    expect(prompt).toContain(
        'if you choose not to read, that is a deferral to report honestly, not a conclusion that nothing is pending'
    );
    expect(prompt).toContain(
        'New messages may be delivered to you automatically while your process stays alive.'
    );

    // Raft parity (startup step 4): processing and replying are one act; the
    // FYI carve-out is Grotto's single documented divergence there
    // (specs/inbox.md silence semantics, scripts/agent-tests fyi-silence-*).
    expect(prompt).toContain(
        'When you receive a message, process it and reply with `grotto message send`.'
    );
    expect(prompt).toContain(
        'an explicit FYI / no-response-needed message settles silently, with no send at all'
    );
});

test('the @Mentions section separates display name from the stable name', () => {
    // Raft parity (`buildMentionsSection`, Computer 1.0.16). Grotto renders one
    // name today, so the bullet reads as a tautology per-agent — it still has to
    // teach that identity reasoning uses the stable name, not the presentation.
    expect(efficiencyPrompt).toContain('Your stable Grotto @mention handle is `@Marlow`.');
    expect(efficiencyPrompt).toContain(
        'Your display name is `Marlow`. Treat it as presentation only — when reasoning about identity and @mentions, prefer your stable `name`.'
    );
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

test('keeps current Raft instruction precedence without an Agent-creation policy', () => {
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

    expect(prompt).toContain('## How these instructions apply');
    expect(prompt).toContain(
        "A user's own instructions override any default that only shapes how you serve them"
    );
    expect(prompt).toContain('### Credential handling');
    expect(prompt).toContain('Credentials follow human intent.');
    expect(prompt).toContain('### Capability and execution-surface selection');
    expect(prompt).toContain("The human's explicit choice of surface is part of that fit.");
    expect(prompt).toContain('### Formatting — URLs in non-English text');
    expect(prompt).not.toContain('### Preparing native action cards');
    expect(prompt).not.toContain('## Security');

    expect(prompt.indexOf('## How these instructions apply')).toBeLessThan(
        prompt.indexOf('## Communication — grotto CLI ONLY')
    );
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

    expect(prompt).toContain('**Asks** — `grotto ask`');
    expect(prompt).toContain('the answer is their reply in the Ask’s thread');

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

    // Reminder/trigger mechanics live in the manual; preserve the reduced prompt budget.
    expect(prompt.length).toBeLessThanOrEqual(37_500);
});

test('teaches automation provenance without an envelope tutorial', () => {
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

    // The fire itself is silent in chat; the Agent's own message carries the
    // provenance, and it lands top-level in the anchor chat.
    expect(prompt).toContain(
        'A fire arrives through your inbox and writes nothing to chat by itself.'
    );
    expect(prompt).not.toContain('the payload excerpt indented two spaces');
    // One `--cause` sentence per section, not two: the placement rule and the
    // provenance reason are the same rule and read as one.
    expect(prompt).not.toContain('When you speak because a reminder fired');
    expect(prompt).not.toContain('When you speak because a trigger fired');
    expect(
        prompt.match(
            /Answer a fire with a new top-level message in the anchor chat, sent with `--cause <fireId>` so the message carries its provenance; never as a reply in any thread, even a thread you were already working in\./gu
        )
    ).toHaveLength(2);
    expect(prompt).not.toContain('the Server records the cause even if you omit the flag');
    expect(prompt).not.toContain(
        "Each fire is its own message; never reply into an earlier fire's thread."
    );

    // Reminder receipts are gone from chat, but wake ownership still never moves.
    expect(prompt).not.toContain('the receipt/fire system message is visible in that surface');
    expect(prompt).toContain('Anchoring to a message or thread does not transfer wake ownership.');
    expect(prompt).toContain('it wakes the author who scheduled it, not other people');
});
