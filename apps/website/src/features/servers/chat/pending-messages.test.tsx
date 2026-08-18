import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildTranscriptEntries } from '../../chats/chat-transcript-model.ts';
import { isLocalTimelineMessageMetadata } from '../../chats/local-timeline-message.ts';
import type { ProjectedChatMessageRow } from './chat-message-model.ts';
import { PendingMessageAttachments, projectPendingChatMessageRows } from './pending-messages.tsx';
import type { PendingChatMessage } from './use-pending-messages.ts';

const pending: PendingChatMessage = {
    attachments: [],
    content: 'Sending this right now.',
    messageId: null,
    nonce: 'nonce_1',
    submittedAt: '2026-08-14T14:41:00.000Z',
};

test('pending sends project as explicitly local transcript messages', () => {
    const [row] = projectPendingChatMessageRows([pending], 'usr_zach');

    expect(row?.actor).toEqual({ id: 'usr_zach', kind: 'participant' });
    expect(row?.message.content).toBe('Sending this right now.');
    expect(isLocalTimelineMessageMetadata(row?.message.metadata)).toBe(true);
});

test('a rapid pending send keeps the same grouped turn shape when it commits', () => {
    const first = userRow({
        content: 'First message.',
        id: 'msg_1',
        timestamp: '2026-08-14T14:40:30.000Z',
    });
    const [pendingSecond] = projectPendingChatMessageRows(
        [{ ...pending, content: 'Second message.' }],
        'usr_zach'
    );
    const committedSecond = userRow({
        content: 'Second message.',
        id: 'msg_2',
        timestamp: pending.submittedAt,
    });

    expect(pendingSecond).toBeDefined();

    const optimistic = buildTranscriptEntries({ rows: [first, pendingSecond!] });
    const committed = buildTranscriptEntries({ rows: [first, committedSecond] });

    expect(optimistic).toHaveLength(1);
    expect(committed).toHaveLength(1);
    expect(optimistic[0]?.id).toBe('msg_1');
    expect(committed[0]?.id).toBe('msg_1');
    expect(optimistic[0]?.kind === 'turn' ? optimistic[0].items : []).toHaveLength(2);
    expect(committed[0]?.kind === 'turn' ? committed[0].items : []).toHaveLength(2);
});

test('every rapid pending send joins the current human turn', () => {
    const rows = projectPendingChatMessageRows(
        [pending, { ...pending, content: 'And this one too.', nonce: 'nonce_2' }],
        'usr_zach'
    );
    const entries = buildTranscriptEntries({ rows });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.kind === 'turn' ? entries[0].items : []).toHaveLength(2);
});

test('an attaching send names its files while the bytes upload', () => {
    const markup = renderToStaticMarkup(
        <PendingMessageAttachments
            attachments={[
                {
                    filename: 'notes.pdf',
                    id: 'nonce_att_1',
                    mediaType: 'application/pdf',
                    sizeBytes: 2048,
                },
            ]}
        />
    );

    expect(markup).toContain('notes.pdf');
    expect(markup).not.toContain('data-slot="attachment-group"');
});

function userRow(input: {
    content: string;
    id: string;
    timestamp: string;
}): ProjectedChatMessageRow {
    const actor = { id: 'usr_zach', kind: 'participant' as const };

    return {
        actor,
        connectsToNext: false,
        connectsToPrevious: false,
        id: input.id,
        isFirstInGroup: true,
        kind: 'message',
        message: {
            actor,
            attachments: [],
            content: input.content,
            id: input.id,
            sender: 'Zach',
            senderType: 'user',
            sourceSessionId: null,
            sourceSessionKey: 'hosted:human',
            task: null,
            timestamp: input.timestamp,
        },
        thread: null,
    };
}
