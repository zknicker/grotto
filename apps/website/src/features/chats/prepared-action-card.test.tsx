import { expect, test } from 'bun:test';
import type { AgentCreatePreparedAction, PreparedAction } from '@grotto/api';
import { renderToStaticMarkup } from 'react-dom/server';
import { PreparedActionCard } from './prepared-action-card.tsx';

const pendingAction: AgentCreatePreparedAction = {
    chatId: 'cht_product',
    createdAt: '2026-08-25T12:00:00.000Z',
    executedAt: null,
    executedByUserId: null,
    id: 'act_1234567890abcdef',
    kind: 'agent:create',
    messageId: 'msg_1234567890abcdef',
    proposerAgentId: 'agt_builder',
    proposal: {
        avatar: {
            byteSize: 8,
            id: 'pam_1234567890abcdef',
            mediaType: 'image/png',
            sha256: 'a'.repeat(64),
            url: '/api/prepared-action-media/pam_1234567890abcdef',
        },
        computer: { computerId: 'cmp_local', kind: 'suggested', label: 'Desk Mac' },
        description: 'Keeps the release tidy.',
        draftHint: 'Start with release notes and small fixes.',
        kind: 'agent:create',
        name: 'Orbit',
    },
    status: 'pending',
    supersededAt: null,
    supersededByActionId: null,
};

test('renders the native pending Agent proposal and exact avatar media', () => {
    const markup = renderToStaticMarkup(
        <PreparedActionCard
            action={pendingAction}
            proposer={{ avatarUrl: '/api/avatars/agt_builder', displayName: 'Builder' }}
        />
    );

    expect(markup).toContain('Agent creation proposal');
    expect(markup).toContain('Prepared by Builder');
    expect(markup).toContain('Pending review');
    expect(markup).toContain('Orbit');
    expect(markup).toContain('Keeps the release tidy.');
    expect(markup).toContain('Desk Mac (suggested)');
    expect(markup).not.toContain('<button');
});

test('renders superseded status without making the card interactive', () => {
    const action: AgentCreatePreparedAction = {
        ...pendingAction,
        status: 'superseded',
        supersededAt: '2026-08-25T12:01:00.000Z',
        supersededByActionId: 'act_fedcba0987654321',
    };
    const markup = renderToStaticMarkup(
        <PreparedActionCard
            action={action}
            proposer={{ avatarUrl: null, displayName: 'Builder' }}
        />
    );

    expect(markup).toContain('Superseded');
    expect(markup).not.toContain('<button');
});

test('unknown action kinds are inert fallback cards', () => {
    const action = {
        ...pendingAction,
        kind: 'channel:create',
        proposal: { name: 'General' },
    } as unknown as PreparedAction;
    const markup = renderToStaticMarkup(
        <PreparedActionCard
            action={action}
            proposer={{ avatarUrl: null, displayName: 'Builder' }}
        />
    );

    expect(markup).toContain('Unsupported action');
    expect(markup).toContain('not available in this version of Grotto');
    expect(markup).not.toContain('<button');
});
