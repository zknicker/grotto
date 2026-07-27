import { expect, test } from 'bun:test';
import { invitationLink, isServerRemindersPath } from './server-routes.ts';

test('invitation links use the configured browser-reachable App origin', () => {
    expect(invitationLink('secret-token', 'https://app.grotto.test')).toBe(
        'https://app.grotto.test/invite/secret-token'
    );
});

test('a Server slugged reminders is not mistaken for the operator route', () => {
    expect(isServerRemindersPath('/s/reminders', 'reminders')).toBe(false);
    expect(isServerRemindersPath('/s/reminders/reminders', 'reminders')).toBe(true);
});
