import { expect, test } from 'bun:test';
import { hostedServerEventIds, hostedServerSlugFromPath } from './hosted-server-event-model.ts';

test('the open Server is observed before the Server list resolves', () => {
    expect(hostedServerEventIds([], { id: 'srv_open' })).toEqual(['srv_open']);
    expect(hostedServerEventIds([{ id: 'srv_open' }], { id: 'srv_open' })).toEqual(['srv_open']);
});

test('hosted Server paths identify the open Server independently of list state', () => {
    expect(hostedServerSlugFromPath('/s/team-room')).toBe('team-room');
    expect(hostedServerSlugFromPath('/s/team-room/members')).toBe('team-room');
    expect(hostedServerSlugFromPath('/s')).toBeNull();
    expect(hostedServerSlugFromPath('/invite/token')).toBeNull();
});
