import assert from 'node:assert/strict';
import test from 'node:test';
import { cachesClearedOnMembershipLoss } from './membership-caches.ts';

/**
 * Every Server cache named here has its data dropped when membership ends.
 * Anything left out stays readable while a refetch runs — and stays readable
 * indefinitely offline — which for Server data means a removed human keeps
 * seeing it.
 */
function caches() {
    const cache = () => ({ reset: () => undefined });

    return {
        agent: { get: cache(), list: cache() },
        chat: { list: cache(), messages: cache(), search: cache() },
        invitation: { list: cache() },
        member: { get: cache(), list: cache() },
        server: { bySlug: cache(), list: cache() },
        stats: { live: cache() },
        task: { assignees: cache(), list: cache() },
        taskLabel: { list: cache() },
    };
}

test('losing membership clears every Server cache that names the Server', () => {
    const utils = caches();
    const cleared = new Set(cachesClearedOnMembershipLoss(utils));

    for (const cache of [
        utils.agent.get,
        utils.agent.list,
        utils.server.bySlug,
        utils.server.list,
        utils.member.get,
        utils.member.list,
        utils.invitation.list,
        utils.chat.list,
        utils.chat.messages,
        utils.chat.search,
        utils.task.list,
        utils.task.assignees,
        utils.taskLabel.list,
        utils.stats.live,
    ]) {
        assert.ok(cleared.has(cache));
    }

    assert.equal(cleared.size, 14);
});

test('the Server list is cleared, not merely refreshed', () => {
    // A removed Server left in the list stays openable until a refetch lands,
    // and never stops being openable while offline.
    const utils = caches();

    assert.ok(cachesClearedOnMembershipLoss(utils).includes(utils.server.list));
});
