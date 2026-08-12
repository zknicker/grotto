import { expect, test } from 'bun:test';
import { hostedAvailabilityLabel, resolveAgentAvatarAvailability } from './agent-avatar.tsx';

test('current activity wins over a stale working availability', () => {
    expect(resolveAgentAvatarAvailability('working', false)).toBe('idle');
    expect(resolveAgentAvatarAvailability('idle', true)).toBe('working');
});

test('DM status copy uses concise global availability labels', () => {
    expect(hostedAvailabilityLabel('idle')).toBe('Online');
    expect(hostedAvailabilityLabel('working')).toBe('Working');
    expect(hostedAvailabilityLabel('offline')).toBe('Offline');
    expect(hostedAvailabilityLabel('stopped')).toBe('Stopped');
    expect(hostedAvailabilityLabel('error')).toBe('Needs attention');
});
