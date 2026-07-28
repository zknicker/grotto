import { expect, test } from 'bun:test';
import {
    invitationLink,
    isServerRemindersPath,
    serverBriefVariationsRoute,
    serverSearchRoute,
} from './server-routes.ts';

test('invitation links use the configured browser-reachable App origin', () => {
    expect(invitationLink('secret-token', 'https://app.grotto.test')).toBe(
        'https://app.grotto.test/invite/secret-token'
    );
});

test('a Server slugged reminders is not mistaken for the operator route', () => {
    expect(isServerRemindersPath('/s/reminders', 'reminders')).toBe(false);
    expect(isServerRemindersPath('/s/reminders/reminders', 'reminders')).toBe(true);
});

test('the brief lab stays inside the Server route', () => {
    expect(serverBriefVariationsRoute('dev')).toBe('/s/dev/design/brief');
});

test('hosted search stays inside the current Server route', () => {
    expect(serverSearchRoute('dev')).toBe('/s/dev/search');
});
