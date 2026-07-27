import { expect, test } from 'bun:test';
import { reminderActionErrorMessage } from './hosted-server-reminders.tsx';

test('surfaces an initial hosted reminder-list failure', () => {
    expect(reminderActionErrorMessage(null, new Error('Hosted list unavailable'))).toBe(
        'Hosted list unavailable'
    );
    expect(
        reminderActionErrorMessage(new Error('Cancel failed'), new Error('Hosted list unavailable'))
    ).toBe('Cancel failed');
});
