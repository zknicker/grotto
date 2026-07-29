import { expect, test } from 'bun:test';
import type { HostedAgent, HostedAgentLifecycleEvent } from '@tavern/api';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    HostedAgentCompositionBubbles,
    hasHostedAgentComposition,
} from './hosted-agent-composition-bubble.tsx';

const agent = {
    character: 'owl',
    displayName: 'Cove',
    id: 'agt_cove',
} as HostedAgent;
const sending = {
    agentId: agent.id,
    chatId: 'cht_parent',
    compositionId: 'cmp_test',
    emittedAt: '2026-07-29T12:00:00.000Z',
    phase: 'sending',
    runId: 'run_test',
    serverId: 'srv_test',
    text: 'I found the answer.',
} satisfies HostedAgentLifecycleEvent;

test('renders an ephemeral Agent send only at its exact chat target', () => {
    const lifecycles = new Map([[agent.id, sending]]);
    const parent = renderToStaticMarkup(
        <HostedAgentCompositionBubbles
            agents={[agent]}
            chatId="cht_parent"
            lifecycles={lifecycles}
        />
    );
    const thread = renderToStaticMarkup(
        <HostedAgentCompositionBubbles
            agents={[agent]}
            chatId="cht_thread"
            lifecycles={lifecycles}
        />
    );

    expect(parent).toContain('Cove');
    expect(parent).toContain('I found the answer.');
    expect(thread).not.toContain('I found the answer.');
    expect(hasHostedAgentComposition('cht_parent', lifecycles)).toBe(true);
    expect(hasHostedAgentComposition('cht_thread', lifecycles)).toBe(false);
});

test('reading is coarse status, never a provisional chat bubble', () => {
    const lifecycles = new Map<string, HostedAgentLifecycleEvent>([
        [
            agent.id,
            {
                ...sending,
                phase: 'reading',
            },
        ],
    ]);

    expect(
        renderToStaticMarkup(
            <HostedAgentCompositionBubbles
                agents={[agent]}
                chatId="cht_parent"
                lifecycles={lifecycles}
            />
        )
    ).not.toContain('I found the answer.');
});
