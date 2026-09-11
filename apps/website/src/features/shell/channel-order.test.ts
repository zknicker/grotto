import { expect, test } from 'bun:test';
import type { Chat } from '@grotto/api';
import { testChat } from '../chats/chat-fixtures.ts';
import { orderChannels, readChannelOrder, writeChannelOrder } from './channel-order.ts';

test('restores known channels and appends newly visible channels', () => {
    const channels = [channel('one'), channel('two'), channel('three')];

    expect(orderChannels(channels, ['two', 'archived', 'one']).map(({ id }) => id)).toEqual([
        'two',
        'one',
        'three',
    ]);
});

test('reads only unique string ids from stored presentation state', () => {
    const storage = { getItem: () => JSON.stringify(['two', 1, 'two', 'one']) };

    expect(readChannelOrder(storage, 'channels')).toEqual(['two', 'one']);
    expect(readChannelOrder({ getItem: () => '{' }, 'channels')).toEqual([]);
});

test('writes the complete visible order', () => {
    let stored = '';
    writeChannelOrder({ setItem: (_key, value) => (stored = value) }, 'channels', [
        channel('two'),
        channel('one'),
    ]);

    expect(stored).toBe('["two","one"]');
});

function channel(id: string): Chat {
    return testChat({ createdAt: '2026-08-25T12:00:00.000Z', id, name: id });
}
