import { expect, test } from 'bun:test';
import {
    actionCardActionSchema,
    agentActionPrepareInputSchema,
    preparedActionSchema,
} from './prepared-actions.ts';

const media = {
    byteSize: 4,
    id: 'pam_1234567890abcdef',
    mediaType: 'image/png' as const,
    sha256: 'a'.repeat(64),
    url: '/api/prepared-action-media/pam_1234567890abcdef',
};

test('the v1 action contract keeps agent:create proposal data narrow', () => {
    const parsed = actionCardActionSchema.parse({
        kind: 'agent:create',
        name: 'Orbit',
    });

    expect(parsed).toEqual({
        computer: null,
        description: null,
        draftHint: null,
        kind: 'agent:create',
        name: 'Orbit',
    });
    expect(
        actionCardActionSchema.safeParse({
            kind: 'agent:create',
            name: 'Orbit',
            avatarMediaId: media.id,
        }).success
    ).toBe(false);
});

test('prepare input carries avatar bytes, never an arbitrary media id', () => {
    expect(
        agentActionPrepareInputSchema.safeParse({
            action: { kind: 'agent:create', name: 'Orbit' },
            avatar: { bytesBase64: 'iVBORw0KGgo=', mediaType: 'image/png' },
            nonce: 'nonce-1',
            target: '#general',
        }).success
    ).toBe(true);
    expect(
        agentActionPrepareInputSchema.safeParse({
            action: { kind: 'agent:create', name: 'Orbit' },
            avatar: { mediaId: media.id },
            nonce: 'nonce-1',
            target: '#general',
        }).success
    ).toBe(false);
});

test('known and future action records share a status envelope', () => {
    const known = preparedActionSchema.parse({
        chatId: 'cht_1',
        createdAt: '2026-08-25T12:00:00.000Z',
        executedAt: null,
        executedByUserId: null,
        id: 'act_1234567890abcdef',
        kind: 'agent:create',
        messageId: 'msg_1',
        proposerAgentId: 'agt_1',
        proposal: {
            avatar: media,
            computer: null,
            description: null,
            draftHint: null,
            kind: 'agent:create',
            name: 'Orbit',
        },
        status: 'pending',
        supersededAt: null,
        supersededByActionId: null,
    });
    const future = preparedActionSchema.parse({
        ...known,
        kind: 'channel:create',
        proposal: { name: 'general' },
    });

    expect(known.kind).toBe('agent:create');
    expect(future.kind).toBe('channel:create');
});
