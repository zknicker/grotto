import { expect, test } from 'bun:test';
import { invitationLink, serverSearchRoute, usageRoute } from './server-routes.ts';

test('invitation links use the configured browser-reachable Grotto App origin', () => {
    expect(invitationLink('secret-token', 'https://app.grotto.test')).toBe(
        'https://app.grotto.test/invite/secret-token'
    );
});

test('search stays inside the current Server route', () => {
    expect(serverSearchRoute('dev')).toBe('/s/dev/search');
});

test('Agent usage links carry removable Agent, Computer, and runtime filters', () => {
    expect(
        usageRoute('dev', {
            computerId: 'cmp_one',
            runtimeId: 'pi',
        })
    ).toBe('/s/dev/usage?computer=cmp_one&runtime=pi');
    expect(usageRoute('dev', { agentId: 'agt_one' })).toBe('/s/dev/usage?agent=agt_one');
    expect(usageRoute('dev')).toBe('/s/dev/usage');
});
