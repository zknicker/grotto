import { expect, test } from 'bun:test';
import type { AgentCliMessage } from './agent-api-schemas.ts';
import { formatDeliveryEnvelope, formatHistoryLine } from './agent-format.ts';

function message(overrides: Partial<AgentCliMessage> = {}): AgentCliMessage {
    return {
        attachments: [],
        author: { id: 'agt_orbit', kind: 'agent', label: 'Orbit', metadata: {} },
        body_kind: 'text',
        chat_id: 'cht_product',
        content: 'The migration is staged. Should I run it?',
        created_at: '2026-09-03T12:00:00.000Z',
        deleted_at: null,
        delivery_id: null,
        id: 'msg_1a2b3c4d5e6f',
        metadata: {},
        nonce: 'ask-1',
        role: 'assistant',
        sender: { description: null, handle: 'orbit', type: 'agent' },
        sequence: 7,
        ...overrides,
    };
}

const openAsk = {
    addressee_handle: 'ada',
    id: 'ask_1a2b3c4d',
    recommended_step: 'Approve the staged migration',
    status: 'open',
    title: 'Run the staged migration?',
} as const;

test('an Ask Message states its lifecycle and addressee on every line it rides', () => {
    const ask = message({ ask: openAsk, body_kind: 'ask' });

    expect(formatHistoryLine(ask)).toEndWith(
        'The migration is staged. Should I run it? [ask status=open to=@ada]'
    );
    expect(formatDeliveryEnvelope('#product', ask)).toEndWith(
        'The migration is staged. Should I run it? [ask status=open to=@ada]'
    );
    expect(
        formatHistoryLine(message({ ask: { ...openAsk, status: 'answered' }, body_kind: 'ask' }))
    ).toEndWith('[ask status=answered to=@ada]');
    // A revoked addressee keeps a Server handle no one can name; the status is
    // still the fact worth carrying.
    expect(
        formatHistoryLine(
            message({ ask: { ...openAsk, addressee_handle: null }, body_kind: 'ask' })
        )
    ).toEndWith('[ask status=open]');
});

test('an ordinary Message carries no Ask suffix, and the suffixes keep their order', () => {
    expect(formatHistoryLine(message())).toEndWith(
        '@orbit: The migration is staged. Should I run it?'
    );
    expect(
        formatHistoryLine(
            message({
                ask: openAsk,
                attachments: [{ filename: 'plan.md', id: 'att_1' }],
                body_kind: 'ask',
                task: {
                    assignee: { handle: 'ada', id: 'usr_ada' },
                    claimed_at: null,
                    created_at: '2026-09-03T12:00:00.000Z',
                    labels: [],
                    number: 3,
                    origin: 'composed',
                    priority: 'none',
                    status: 'in_progress',
                    updated_at: '2026-09-03T12:00:00.000Z',
                },
            })
        )
    ).toEndWith(
        '[1 attachment: plan.md (id:att_1) — use grotto attachment view to download]' +
            ' [task #3 status=in_progress assignee=@ada] [ask status=open to=@ada]'
    );
});
