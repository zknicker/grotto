import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PendingChatMessageRows } from './pending-messages.tsx';
import type { PendingChatMessage } from './use-pending-messages.ts';

const pending: PendingChatMessage = {
    attachments: [],
    content: 'Sending this right now.',
    messageId: null,
    nonce: 'nonce_1',
};

function render(messages: readonly PendingChatMessage[]) {
    return renderToStaticMarkup(
        <PendingChatMessageRows
            agents={[]}
            authorAvatarUrl={null}
            authorName="Zach"
            messages={messages}
        />
    );
}

test('a pending row shows the sender and their text, visibly in flight', () => {
    const markup = render([pending]);

    expect(markup).toContain('Sending this right now.');
    expect(markup).toContain('Zach');
    expect(markup).toContain('opacity-70');
    expect(markup).toContain('data-slot="pending-chat-message"');
});

test('every queued send renders its own row', () => {
    const markup = render([
        pending,
        { ...pending, content: 'And this one too.', nonce: 'nonce_2' },
    ]);

    expect(markup.match(/data-slot="pending-chat-message"/gu)).toHaveLength(2);
});

test('an attaching send names its files while the bytes upload', () => {
    const markup = render([
        {
            ...pending,
            attachments: [
                {
                    filename: 'notes.pdf',
                    id: 'nonce_att_1',
                    mediaType: 'application/pdf',
                    sizeBytes: 2048,
                },
            ],
        },
    ]);

    expect(markup).toContain('notes.pdf');
});
