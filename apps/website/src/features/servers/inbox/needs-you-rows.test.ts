import { describe, expect, test } from 'bun:test';
import type { TaskItem } from '../tasks/task-model.ts';
import type { NeedsYouAsk } from './needs-you-asks.ts';
import { needsYouRowTarget, stalledClaimTitle, toNeedsYouRows } from './needs-you-rows.ts';

const ask: NeedsYouAsk = {
    agentId: 'agt_cove',
    agentName: 'Cove',
    chatLabel: '#onboarding-owner',
    conversationChatId: 'cht_1',
    id: 'msg_ask',
    recommendedStep: 'Yes, rename it',
    summary: 'Two agents keep filing build questions in #product.',
    threadAnchorMessageId: 'msg_anchor',
    threadChatId: 'cht_thread',
    title: 'Rename #product to #build?',
};

const claim = {
    assigneeAgentId: 'agt_blippy',
    assigneeAvatarUrl: 'https://example.test/blippy.png',
    assigneeLabel: 'Blippy',
    chatLabel: '#all',
    id: 'msg_claim',
    number: 3,
    title: 'Reminders on the weekly digest fired twice this morning.',
} as TaskItem;

describe('toNeedsYouRows', () => {
    test('Asks lead, and each row states its kind and origin', () => {
        const rows = toNeedsYouRows([ask], [claim]);

        expect(rows.map((row) => row.kind)).toEqual(['ask', 'claim']);
        expect(rows[0]).toMatchObject({
            agentId: 'agt_cove',
            markName: 'Cove',
            meta: 'Ask · #onboarding-owner',
            preview: 'Two agents keep filing build questions in #product.',
            title: 'Rename #product to #build?',
        });
        expect(rows[1]).toMatchObject({
            agentId: 'agt_blippy',
            avatarUrl: 'https://example.test/blippy.png',
            meta: '#all · Task #3',
            preview: 'Reminders on the weekly digest fired twice this morning.',
            title: 'Blippy stopped before finishing',
        });
    });

    test('every row carries the payload its action needs', () => {
        const [askRow, claimRow] = toNeedsYouRows([ask], [claim]);

        expect(askRow?.kind === 'ask' && askRow.ask.recommendedStep).toBe('Yes, rename it');
        expect(claimRow?.kind === 'claim' && claimRow.claim.number).toBe(3);
    });

    test('an Ask and a claim on the same Message stay two reachable rows', () => {
        const shared = 'msg_shared';
        const rows = toNeedsYouRows([{ ...ask, id: shared }], [{ ...claim, id: shared }]);

        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.id)).toEqual(['ask:msg_shared', 'claim:msg_shared']);

        // The list resolves an action by row id, the way ListView's onAction
        // does; each id must reach its own row and its own deep link.
        for (const row of rows) {
            const found = rows.find((candidate) => candidate.id === row.id);
            expect(found).toBe(row);
            expect(found && needsYouRowTarget(found)).toBe(shared);
        }
        expect(rows.map((row) => row.kind)).toEqual(['ask', 'claim']);
    });

    test('the deep-link target is the payload Message, not the namespaced id', () => {
        const [askRow, claimRow] = toNeedsYouRows([ask], [claim]);

        expect(askRow && needsYouRowTarget(askRow)).toBe('msg_ask');
        expect(claimRow && needsYouRowTarget(claimRow)).toBe('msg_claim');
    });
});

describe('stalledClaimTitle', () => {
    test('names who stopped', () => {
        expect(stalledClaimTitle({ assigneeLabel: 'Tiny' })).toBe('Tiny stopped before finishing');
    });
});
