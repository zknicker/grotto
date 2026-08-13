import { expect, test } from 'bun:test';
import { availabilityBadgeColor, availabilityLabel } from './agent-avatar.tsx';

test('DM status copy uses concise global availability labels', () => {
    expect(availabilityLabel('idle')).toBe('Online');
    expect(availabilityLabel('working')).toBe('Working');
    expect(availabilityLabel('offline')).toBe('Offline');
    expect(availabilityLabel('stopped')).toBe('Stopped');
    expect(availabilityLabel('error')).toBe('Needs attention');
});

test('availability maps onto HeroUI Badge colors', () => {
    expect(availabilityBadgeColor('idle')).toBe('success');
    expect(availabilityBadgeColor('working')).toBe('warning');
    expect(availabilityBadgeColor('error')).toBe('danger');
    expect(availabilityBadgeColor('offline')).toBe('default');
});
