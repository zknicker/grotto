import { expect, test } from 'bun:test';
import { testAgent } from '../../members/agent-fixtures.ts';
import { liveAgentActorProfile } from './chat-actor-profiles.ts';

test('live Agent profiles preserve canonical availability for transcript avatars', () => {
    const agent = testAgent({
        availability: 'offline',
        avatarUrl: '/api/avatars/blippy',
        displayName: 'Blippy',
        handle: 'blippy',
        id: 'agt_blippy',
    });

    expect(liveAgentActorProfile(agent)).toMatchObject({
        deleted: false,
        id: 'agt_blippy',
        kind: 'agent',
        availability: { kind: 'live', value: 'offline' },
    });
});
