import { expect, test } from 'bun:test';
import type { Agent } from '@grotto/api';
import { liveAgentActorProfile } from './chat-actor-profiles.ts';

test('live Agent profiles preserve canonical availability for transcript avatars', () => {
    const agent = {
        availability: 'offline',
        avatarUrl: '/api/avatars/blippy',
        computerId: 'cmp_one',
        createdAt: '2026-08-14T12:00:00.000Z',
        createdByUserId: 'usr_owner',
        description: 'Product Agent',
        desiredModelId: 'gpt-5',
        desiredReasoningEffort: 'medium',
        desiredRuntimeId: 'codex',
        displayName: 'Blippy',
        dmChatId: 'cht_blippy',
        effectiveModelId: 'gpt-5',
        effectiveReasoningEffort: 'medium',
        effectiveReportedAt: '2026-08-14T12:00:00.000Z',
        effectiveRuntimeId: 'codex',
        factoryKind: 'ordinary',
        grottoAgent: {
            appliedAt: '2026-08-14T12:00:00.000Z',
            appliedVersion: '1.0.0',
            currentVersion: '1.0.0',
            status: 'current',
        },
        handle: 'blippy',
        id: 'agt_blippy',
        missingResources: [],
        role: 'member',
        serverId: 'srv_dev',
        status: 'applied',
    } satisfies Agent;

    expect(liveAgentActorProfile(agent)).toMatchObject({
        deleted: false,
        id: 'agt_blippy',
        kind: 'agent',
        availability: { kind: 'live', value: 'offline' },
    });
});
