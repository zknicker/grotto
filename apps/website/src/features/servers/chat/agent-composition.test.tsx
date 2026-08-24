import { expect, test } from 'bun:test';
import type { Agent, AgentLifecycleEvent } from '@grotto/api';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentCompositionBubbles, hasAgentComposition } from './agent-composition.tsx';

const agent = {
    avatarUrl: null,
    displayName: 'Cove',
    id: 'agt_cove',
} as Agent;
const sending = {
    agentId: agent.id,
    chatId: 'cht_parent',
    compositionId: 'cmp_test',
    emittedAt: '2026-07-29T12:00:00.000Z',
    phase: 'sending',
    runId: 'run_test',
    serverId: 'srv_test',
    text: 'I found the answer.',
} satisfies AgentLifecycleEvent;

test('renders an ephemeral Agent send only at its exact chat target', () => {
    const lifecycles = new Map([[agent.id, sending]]);
    const parent = renderToStaticMarkup(
        <AgentCompositionBubbles agents={[agent]} chatId="cht_parent" lifecycles={lifecycles} />
    );
    const thread = renderToStaticMarkup(
        <AgentCompositionBubbles agents={[agent]} chatId="cht_thread" lifecycles={lifecycles} />
    );

    expect(parent).toContain('Cove');
    expect(parent).toContain('I found the answer.');
    expect(thread).not.toContain('I found the answer.');
    expect(hasAgentComposition('cht_parent', lifecycles)).toBe(true);
    expect(hasAgentComposition('cht_thread', lifecycles)).toBe(false);
});

test('reading is coarse status, never a provisional chat bubble', () => {
    const lifecycles = new Map<string, AgentLifecycleEvent>([
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
            <AgentCompositionBubbles agents={[agent]} chatId="cht_parent" lifecycles={lifecycles} />
        )
    ).not.toContain('I found the answer.');
});
