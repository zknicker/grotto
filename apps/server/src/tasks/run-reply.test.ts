import { expect, test } from 'bun:test';
import { classifyRunReply } from './run-reply.ts';

const early = new Date('2026-09-08T12:00:00.000Z');
const late = new Date('2026-09-08T12:05:00.000Z');

test('a run that never replied proves nothing either way', () => {
    expect(classifyRunReply({ lastOperationAt: null, latestReplyAt: null })).toBe('none');
    expect(classifyRunReply({ lastOperationAt: late, latestReplyAt: null })).toBe('none');
});

test('a reply from a run that did no work is the whole answer', () => {
    expect(classifyRunReply({ lastOperationAt: null, latestReplyAt: early })).toBe('finishing');
});

test('a reply after the last operation is the finishing word', () => {
    expect(classifyRunReply({ lastOperationAt: early, latestReplyAt: late })).toBe('finishing');
});

test('a reply the run kept working past is only an acknowledgment', () => {
    expect(classifyRunReply({ lastOperationAt: late, latestReplyAt: early })).toBe(
        'acknowledgment'
    );
});

test('equal stamps read as finishing, since clock granularity is not evidence', () => {
    expect(classifyRunReply({ lastOperationAt: late, latestReplyAt: new Date(late) })).toBe(
        'finishing'
    );
});
