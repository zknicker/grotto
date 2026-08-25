import { expect, test } from 'bun:test';
import { resolveChatCompositionTarget } from '../chat-composition-target.ts';
import { threadPaneTitles } from './thread-target.ts';

const baseChat = {
    displayName: 'general',
    participants: [],
    scope: 'channel' as const,
    targetParticipant: null,
    title: '#general',
    type: 'grotto',
};

test('threadPaneTitles names a channel and shortens canonical anchor ids', () => {
    expect(
        threadPaneTitles(
            { ...baseChat, conversationKind: 'channel' },
            'msg_12345678abcdef0012345678abcdef00'
        )
    ).toEqual({
        header: 'Thread — #general',
        target: '#general:12345678',
    });
});

test('threadPaneTitles keeps non-canonical anchor ids exact and resolvable', () => {
    expect(
        threadPaneTitles({ ...baseChat, conversationKind: 'channel' }, 'msg_demo_anchor')
    ).toEqual({
        header: 'Thread — #general',
        target: '#general:msg_demo_anchor',
    });
    expect(
        threadPaneTitles(
            { ...baseChat, conversationKind: 'channel' },
            'msg_01234567-89ab-cdef-0123-456789abcdef'
        )
    ).toEqual({
        header: 'Thread — #general',
        target: '#general:msg_01234567-89ab-cdef-0123-456789abcdef',
    });
});

test('threadPaneTitles names a DM for its non-operator peer', () => {
    expect(
        threadPaneTitles(
            {
                ...baseChat,
                conversationKind: 'direct',
                participants: [
                    { actorId: 'usr_grotto', actorType: 'participant', name: 'You' },
                    { actorId: 'agent-tiny', actorType: 'agent', name: 'Tiny' },
                ],
                scope: 'dm',
            },
            'msg_abcdef00987654abcdef00987654abcd'
        )
    ).toEqual({
        header: 'Thread — @Tiny',
        target: 'dm:@Tiny:abcdef00',
    });
});

test('threadPaneTitles omits the copyable target for task threads', () => {
    expect(
        threadPaneTitles(
            {
                ...baseChat,
                conversationKind: 'task',
                displayName: 'T-1: Fix',
                scope: 'task',
                title: 'T-1: Fix',
            },
            'msg_abcdef00987654abcdef00987654abcd'
        )
    ).toEqual({
        header: 'Thread — T-1: Fix',
        target: null,
    });
});

test('resolveChatCompositionTarget keeps the full thread target', () => {
    expect(
        resolveChatCompositionTarget({
            ...baseChat,
            conversationKind: 'channel',
            id: 'cht_thr_12345678abcdef0012345678abcdef00',
        })
    ).toBe('#general:12345678');
});
