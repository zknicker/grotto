import { expect, test } from 'bun:test';
import { invitationLink, serverSearchRoute, taskThreadRoute } from './server-routes.ts';

test('invitation links use the configured browser-reachable Grotto App origin', () => {
    expect(invitationLink('secret-token', 'https://app.grotto.test')).toBe(
        'https://app.grotto.test/invite/secret-token'
    );
});

test('hosted search stays inside the current Server route', () => {
    expect(serverSearchRoute('dev')).toBe('/s/dev/search');
});

test('a task row opens its canonical Chat with the exact task selected', () => {
    expect(taskThreadRoute('dev', 'chat/one', 'message?one')).toBe(
        '/s/dev/chats/chat%2Fone?task=message%3Fone'
    );
});
