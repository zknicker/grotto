import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
    MessageScroller,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from '../../components/chats/message-scroller.tsx';
import { DevModeProvider } from '../../components/dev-mode-provider.tsx';
import { ChatTranscriptPresentation } from './chat-transcript.tsx';
import type { TranscriptRow } from './chat-transcript-model.ts';
import type { TranscriptRenderContextValue } from './chat-transcript-render-context.tsx';
import type { TranscriptMessageRow } from './transcript-contract.ts';

test('every promoted message in a run keeps its own task mark', () => {
    // A turn's header speaks for one task, so a promoted message must open a
    // turn of its own. Let two consecutive promotions merge and the second
    // task loses its mark while the first header speaks for both.
    const markup = renderTranscript([
        taskRow('msg_1', 'Ship the board', { number: 1 }),
        taskRow('msg_2', 'Write the docs', { number: 2 }),
    ]);

    assert.match(markup, /Task #1/);
    assert.match(markup, /Task #2/);
});

test('a live background claim with an empty Thread is a header mark and nothing else', () => {
    const markup = renderTranscript([
        taskRow('msg_1', 'Rename the deploy script', {
            live: true,
            origin: 'claimed',
            status: 'in_progress',
            tier: 'background',
        }),
    ]);

    assert.match(markup, /task-claim-mark/);
    assert.match(markup, /task-live-ellipsis/);
    // Nothing has been said yet, so a recessed card would be an empty frame.
    assert.doesNotMatch(markup, /message-task-chip/);
    assert.doesNotMatch(markup, /Open thread/);
});

test('a background claim a peer replied in gets the ordinary replies surface', () => {
    const row = taskRow('msg_1', 'Rename the deploy script', {
        live: true,
        origin: 'claimed',
        status: 'in_progress',
        tier: 'background',
    });
    const markup = renderTranscript([{ ...row, thread: threadSummary('msg_1', 2) }]);

    // The conversation is real, so it reads the way every other Thread does.
    assert.match(markup, /Open thread/);
    assert.match(markup, /2 replies/);
    // The task is still background, so its title stays off the card.
    assert.doesNotMatch(markup, /message-task-chip/);
    // The claim still belongs to the message it was claimed against.
    assert.match(markup, /task-claim-mark/);
});

test('a background claim nobody is running keeps the glyph and drops the motion', () => {
    const markup = renderTranscript([
        taskRow('msg_1', 'Rename the deploy script', {
            origin: 'claimed',
            status: 'in_progress',
            tier: 'background',
        }),
    ]);

    assert.match(markup, /task-claim-mark/);
    assert.doesNotMatch(markup, /task-live-ellipsis/);
});

test('a finished background claim leaves the message it was claimed against', () => {
    const markup = renderTranscript([
        taskRow('msg_1', 'Rename the deploy script', {
            origin: 'claimed',
            status: 'done',
            tier: 'background',
        }),
    ]);

    // The receipt is the Agent's reply's to carry from here on.
    assert.doesNotMatch(markup, /task-claim-mark/);
    assert.doesNotMatch(markup, /message-task-chip/);
});

test('a tracked task with an empty Thread is a header mark and nothing else', () => {
    const markup = renderTranscript([taskRow('msg_1', 'Ship the board', { number: 3 })]);

    // Tier is a lens, not a mark: an empty Thread has nothing to put in a card.
    assert.match(markup, /task-claim-mark/);
    assert.match(markup, /Task #3 todo/);
    assert.doesNotMatch(markup, /message-task-chip/);
    assert.doesNotMatch(markup, /Open thread/);
});

test('a tracked task waiting on review wears the in-review disc', () => {
    const markup = renderTranscript([
        taskRow('msg_1', 'Ship the board', { number: 3, status: 'in_review' }),
    ]);

    assert.match(markup, /task-claim-mark/);
    assert.match(markup, /Task #3 in review/);
    assert.match(markup, /--label-purple-fg/);
});

test('a tracked task hands the surface its title once somebody replies', () => {
    const row = taskRow('msg_1', 'Ship the board', { number: 3, status: 'in_progress' });
    const markup = renderTranscript([{ ...row, thread: threadSummary('msg_1', 1) }]);

    assert.match(markup, /message-task-chip/);
    assert.match(markup, /Open thread/);
    // The card states the task, so the message header stops repeating it.
    assert.doesNotMatch(markup, /task-claim-mark/);
});

test('a finished tracked task leaves the anchor for its reply’s receipt', () => {
    const markup = renderTranscript(
        [taskRow('msg_1', 'Ship the board', { number: 4, status: 'done' }), agentRow('msg_reply')],
        {
            handledTaskMarks: new Map([
                [
                    'msg_reply',
                    {
                        anchorMessageId: 'msg_1',
                        claimedAt: '2026-09-08T12:00:00.000Z',
                        doneAt: '2026-09-08T12:00:20.000Z',
                        number: 4,
                    },
                ],
            ]),
        }
    );

    assert.match(markup, /handled #4/);
    assert.doesNotMatch(markup, /task-claim-mark/);
    assert.doesNotMatch(markup, /Open thread/);
});

test('the reply that answered a task carries its receipt', () => {
    const markup = renderTranscript([agentRow('msg_reply')], {
        handledTaskMarks: new Map([
            [
                'msg_reply',
                {
                    anchorMessageId: 'msg_1',
                    claimedAt: '2026-09-08T12:00:00.000Z',
                    doneAt: '2026-09-08T12:00:20.000Z',
                    number: 4,
                },
            ],
        ]),
    });

    assert.match(markup, /handled #4/);
});

function taskRow(
    id: string,
    content: string,
    overrides: Partial<NonNullable<TranscriptMessageRow['message']['task']>> = {}
): TranscriptMessageRow {
    return {
        actor: null,
        connectsToNext: false,
        connectsToPrevious: false,
        id,
        isFirstInGroup: true,
        kind: 'message',
        message: {
            content,
            id,
            sender: 'You',
            senderType: 'user',
            sourceSessionId: null,
            sourceSessionKey: 'session-1',
            task: {
                assignee: { handle: 'blippy', id: 'agt_blippy', kind: 'agent' },
                claimed_at: '2026-09-08T12:00:00.000Z',
                created_at: '2026-09-08T12:00:00.000Z',
                labels: [],
                live: false,
                number: 1,
                origin: 'composed',
                priority: 'none',
                status: 'todo',
                tier: 'tracked',
                updated_at: '2026-09-08T12:00:20.000Z',
                ...overrides,
            },
            timestamp: '2026-09-08T12:00:00.000Z',
        },
    };
}

function threadSummary(anchorMessageId: string, replyCount: number) {
    return {
        anchorMessageId,
        followed: false,
        latestReplyAt: '2026-09-08T12:00:30.000Z',
        replyCount,
        threadChatId: 'cht_thread',
        unreadCount: 0,
    };
}

function agentRow(id: string): TranscriptMessageRow {
    return {
        actor: { id: 'agt_blippy', kind: 'agent' },
        connectsToNext: false,
        connectsToPrevious: false,
        id,
        isFirstInGroup: true,
        kind: 'message',
        message: {
            content: 'Renamed it and pushed.',
            grottoAgentId: 'agt_blippy',
            id,
            sender: 'Blippy',
            senderType: 'agent',
            sourceSessionId: null,
            sourceSessionKey: 'hosted:agt_blippy',
            timestamp: '2026-09-08T12:00:20.000Z',
        },
    };
}

/** The transcript as a host renders it, with only the marks under test wired. */
function renderTranscript(
    rows: TranscriptRow[],
    overrides: Partial<TranscriptRenderContextValue> = {}
) {
    const context: TranscriptRenderContextValue = {
        canRequestMention: true,
        conversationLayout: { showAgentIdentity: true, showHumanIdentity: true },
        defaultOpenWorkGroups: false,
        flashMessageId: null,
        hiddenCount: 0,
        onOpenThread: () => undefined,
        onUnfollowThread: () => undefined,
        repliedRunIds: new Set(),
        shouldAnimateItemEnter: () => false,
        threadActionsEnabled: true,
        ...overrides,
    };

    return renderToStaticMarkup(
        <MemoryRouter>
            <DevModeProvider>
                <MessageScrollerProvider>
                    <MessageScroller>
                        <MessageScrollerViewport>
                            <ChatTranscriptPresentation renderContext={context} rows={rows} />
                        </MessageScrollerViewport>
                    </MessageScroller>
                </MessageScrollerProvider>
            </DevModeProvider>
        </MemoryRouter>
    );
}
