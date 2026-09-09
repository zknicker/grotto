import { describe, expect, test } from 'vitest';
import { isThreadAnchorRow, threadSurfaceVisible } from './thread-message-surface.tsx';

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

describe('thread surface visibility', () => {
    const nothing = {
        ask: false,
        hoisted: false,
        threadHasMessages: false,
        tracked: false,
        work: false,
    };

    test('a background claim with an empty Thread renders no surface', () => {
        expect(threadSurfaceVisible(nothing)).toBe(false);
    });

    test('a Thread with anything in it gets a surface, background claim or not', () => {
        expect(threadSurfaceVisible({ ...nothing, threadHasMessages: true })).toBe(true);
    });

    test('a mark that needs somewhere to sit opens the surface before the first reply', () => {
        expect(threadSurfaceVisible({ ...nothing, tracked: true })).toBe(true);
        expect(threadSurfaceVisible({ ...nothing, ask: true })).toBe(true);
        expect(threadSurfaceVisible({ ...nothing, work: true })).toBe(true);
        expect(threadSurfaceVisible({ ...nothing, hoisted: true })).toBe(true);
    });
});

function messageRow(id: string, metadata: Record<string, unknown> = {}) {
    return {
        id,
        kind: 'message',
        message: { id: id.startsWith('act_') ? 'msg_narration' : id, metadata },
    } as never;
}
