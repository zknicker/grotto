import { expect, test } from 'bun:test';
import { hostedServerEventTargets, hostedServerSlugFromPath } from './hosted-server-event-model.ts';

test('the open Server is observed before the Server list resolves', () => {
    expect(hostedServerEventTargets([], { id: 'srv_open', slug: 'team-room' })).toEqual([
        { id: 'srv_open', slug: 'team-room' },
    ]);
    expect(
        hostedServerEventTargets([{ id: 'srv_open', slug: 'team-room' }], {
            id: 'srv_open',
            slug: 'team-room',
        })
    ).toEqual([{ id: 'srv_open', slug: 'team-room' }]);
});

test('every observed Server carries the slug its detail read is cached under', () => {
    expect(
        hostedServerEventTargets(
            [
                { id: 'srv_one', slug: 'team-room' },
                { id: 'srv_two', slug: 'lab' },
            ],
            null
        )
    ).toEqual([
        { id: 'srv_one', slug: 'team-room' },
        { id: 'srv_two', slug: 'lab' },
    ]);
});

test('hosted Server paths identify the open Server independently of list state', () => {
    expect(hostedServerSlugFromPath('/s/team-room')).toBe('team-room');
    expect(hostedServerSlugFromPath('/s/team-room/members')).toBe('team-room');
    expect(hostedServerSlugFromPath('/s')).toBeNull();
    expect(hostedServerSlugFromPath('/invite/token')).toBeNull();
});
