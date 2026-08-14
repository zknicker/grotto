import { expect, test } from 'bun:test';
import { mergeChatMessagePages } from './hooks.ts';

test('merges newest-first pages into one chronological message list', () => {
    const newestPage = { messages: [{ id: 'message-3' }, { id: 'message-4' }] };
    const olderPage = {
        messages: [{ id: 'message-1' }, { id: 'message-2' }, { id: 'message-3' }],
    };

    expect(mergeChatMessagePages([newestPage, olderPage])).toEqual([
        { id: 'message-1' },
        { id: 'message-2' },
        { id: 'message-3' },
        { id: 'message-4' },
    ]);
});
