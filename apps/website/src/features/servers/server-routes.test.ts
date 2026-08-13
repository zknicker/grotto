import { expect, test } from 'bun:test';
import { invitationLink, serverSearchRoute } from './server-routes.ts';

test('invitation links use the configured browser-reachable Grotto App origin', () => {
    expect(invitationLink('secret-token', 'https://app.grotto.test')).toBe(
        'https://app.grotto.test/invite/secret-token'
    );
});

test('hosted search stays inside the current Server route', () => {
    expect(serverSearchRoute('dev')).toBe('/s/dev/search');
});
