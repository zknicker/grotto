import { describe, expect, test } from 'vitest';
import { isThreadAnchorRow } from './thread-message-surface.tsx';

describe('thread message surface', () => {
    test('offers thread actions only for durable, settled message rows', () => {
        expect(isThreadAnchorRow(messageRow('msg_durable'))).toBe(true);
        expect(isThreadAnchorRow(messageRow('act_narration'))).toBe(false);
        expect(
            isThreadAnchorRow(messageRow('msg_optimistic', { __grottoLocalTimelineMessage: true }))
        ).toBe(false);
        expect(
            isThreadAnchorRow(messageRow('msg_streaming', { runtime: { streaming: true } }))
        ).toBe(false);
        expect(isThreadAnchorRow(messageRow('external-message-id'))).toBe(false);
    });
});

function messageRow(id: string, metadata: Record<string, unknown> = {}) {
    return {
        id,
        kind: 'message',
        message: { id: id.startsWith('act_') ? 'msg_narration' : id, metadata },
    } as never;
}
