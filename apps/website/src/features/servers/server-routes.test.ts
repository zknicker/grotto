import { expect, test } from 'bun:test';
import { invitationLink, membersUsageRoute, serverSearchRoute } from './server-routes.ts';

test('invitation links use the configured browser-reachable Grotto App origin', () => {
    expect(invitationLink('secret-token', 'https://app.grotto.test')).toBe(
        'https://app.grotto.test/invite/secret-token'
    );
});

test('search stays inside the current Server route', () => {
    expect(serverSearchRoute('dev')).toBe('/s/dev/search');
});

test('Agent usage links carry removable Computer and runtime filters', () => {
    expect(
        membersUsageRoute('dev', {
            computerId: 'cmp_one',
            runtimeId: 'pi',
        })
    ).toBe('/s/dev/members?computer=cmp_one&runtime=pi');
});
