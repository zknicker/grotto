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

    // Current Raft parity adds precedence, credential, capability-selection,
    // and URL-formatting guidance, and the Triggers section adds the inbound
    // stimulus primitive (~1.5k chars with its command-family entry and Raft's
    // third-party message-safety paragraph). Automation provenance then adds the
    // trigger and reminder fire envelopes plus the `--cause` habit (~550 chars),
    // which is why the reviewed ceiling moved from 36,500 to 37,000. Replacing
    // the negative one-message-per-fire line with the positive placement rule
    // ("a new top-level message in the anchor chat") cost another ~190 chars.
    // Merging each section's doubled `--cause` sentence into one gives ~150 back,
    // and the one cause-inference sentence spends ~195: net +45, taking the
    // rendered prompt from 36,763 to 36,808 — still inside the reviewed 37,000.
    // Saying where a fire actually arrives — in the wake it causes, or the next
    // turn when busy — instead of implying a pull spends ~168 more, taking it to
    // 36,976. That leaves almost no headroom on purpose: the next
    // prompt-teaching change needs its own review, not a bump.
    //
    // Reviewed bump to 38,000: the task promotion rule was rewritten because the
    // old broad "requires action → claim it" rule turned one-turn conversational
    // requests into tasks that sat in `in_progress` forever. Naming both
    // promotion conditions, the same-turn counter-example, the self-`done`
    // close-out, and the stale `in_review` window costs ~900 chars, and every
    // one of those sentences fixes a live production failure. Headroom is again
    // deliberately thin.
    expect(prompt.length).toBeLessThanOrEqual(38_000);
});

test('teaches automation provenance: silent fires, envelopes, and top-level fire answers', () => {
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
        'the payload excerpt indented two spaces, and a closing `reply with: grotto message send --cause <fireId>` line'
    );
    expect(prompt).toContain(
        'A fire writes nothing to chat by itself; it arrives in the wake it causes — the prompt you start with, or your next turn if you were busy — as a `🔔 Reminder: <title>` envelope'
    );
    expect(prompt).toContain('with any script output riding that same envelope');
    // One `--cause` sentence per section, not two: the placement rule and the
    // provenance reason are the same rule and read as one.
    expect(prompt).not.toContain('When you speak because a reminder fired');
    expect(prompt).not.toContain('When you speak because a trigger fired');
    expect(
        prompt.match(
            /Answer a fire with a new top-level message in the anchor chat, sent with `--cause <fireId>` so the message carries its provenance; never as a reply in any thread, even a thread you were already working in\./gu
        )
    ).toHaveLength(2);
    // Inference is stated once and framed as the Server's safety net.
    expect(
        prompt.match(
            /When a fire was the only thing that woke you, the Server records the cause even if you omit the flag — for reminder and trigger fires alike — but naming it explicitly is always correct\./gu
        )
    ).toHaveLength(1);
    expect(prompt).not.toContain(
        "Each fire is its own message; never reply into an earlier fire's thread."
    );

    // Reminder receipts are gone from chat, but wake ownership still never moves.
    expect(prompt).not.toContain('the receipt/fire system message is visible in that surface');
    expect(prompt).toContain('Anchoring to a message or thread does not transfer wake ownership.');
    expect(prompt).toContain('it wakes the author who scheduled it, not other people');
});
