import assert from 'node:assert/strict';
import test from 'node:test';
import {
    cachesClearedOnMembershipLoss,
    type HostedServerCaches,
} from './hosted-membership-caches.ts';

/**
 * Every hosted cache named here has its data dropped when membership ends.
 * Anything left out stays readable while a refetch runs — and stays readable
 * indefinitely offline — which for Server data means a removed human keeps
 * seeing it.
 */
function hostedCaches(): HostedServerCaches {
    const cache = () => ({ reset: () => undefined });

    return {
        chat: { list: cache(), messages: cache(), search: cache() },
        invitation: { list: cache() },
        member: { list: cache() },
        server: { bySlug: cache(), list: cache() },
    };
}

test('losing membership clears every hosted cache that names the Server', () => {
    const utils = hostedCaches();
    const cleared = new Set(cachesClearedOnMembershipLoss(utils));

    for (const cache of [
        utils.server.bySlug,
        utils.server.list,
        utils.member.list,
        utils.invitation.list,
        utils.chat.list,
        utils.chat.messages,
        utils.chat.search,
    ]) {
        assert.ok(cleared.has(cache));
    }

    assert.equal(cleared.size, 7);
});

test('the Server list is cleared, not merely refreshed', () => {
    // A removed Server left in the list stays openable until a refetch lands,
    // and never stops being openable while offline.
    const utils = hostedCaches();

    assert.ok(cachesClearedOnMembershipLoss(utils).includes(utils.server.list));
});
