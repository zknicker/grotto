import { expect, test } from 'bun:test';
import { invitationLink } from './server-routes.ts';

test('invitation links use the configured browser-reachable App origin', () => {
    expect(invitationLink('secret-token', 'https://app.grotto.test')).toBe(
        'https://app.grotto.test/invite/secret-token'
    );
});
