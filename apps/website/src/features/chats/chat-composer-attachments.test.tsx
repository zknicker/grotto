import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatComposerAttachmentList } from './chat-composer-attachments.tsx';
import { hasFileTransfer } from './chat-composer-file-drop.ts';

test('detects file drag transfers', () => {
    expect(hasFileTransfer({ types: ['Files'] })).toBe(true);
    expect(hasFileTransfer({ types: ['text/plain'] })).toBe(false);
});

describe('ChatComposerAttachmentList', () => {
    test('renders image attachments as preview tiles with remove controls', () => {
        const markup = renderToStaticMarkup(
            <ChatComposerAttachmentList
                attachments={[
                    {
                        dataBase64: 'AA==',
                        filename: 'first.png',
                        mediaType: 'image/png',
                        sizeBytes: 128,
                        type: 'inline',
                    },
                    {
                        dataBase64: 'AA==',
                        filename: 'second.png',
                        mediaType: 'image/png',
                        sizeBytes: 256,
                        type: 'inline',
                    },
                ]}
                onRemove={() => {}}
            />
        );

        expect(markup).toContain('chat-attachment-group');
        expect(markup.match(/data-slot="chat-attachment"/g)).toHaveLength(2);
        expect(markup).toContain('src="data:image/png;base64,AA=="');
        expect(markup).toContain('Remove first.png');
        expect(markup).toContain('Remove second.png');
        expect(markup).toContain('first.png - 128 B');
    });

    test('renders non-image attachments with the document fallback preview', () => {
        const markup = renderToStaticMarkup(
            <ChatComposerAttachmentList
                attachments={[
                    {
                        filename: 'notes.md',
                        mediaType: 'text/markdown',
                        path: '/tmp/notes.md',
                        sizeBytes: 512,
                        type: 'file',
                    },
                ]}
                onRemove={() => {}}
            />
        );

        expect(markup).toContain('chat-attachment__preview-fallback');
        expect(markup).not.toContain('<img');
        expect(markup).toContain('notes.md');
        expect(markup).toContain('Remove notes.md');
    });

    test('renders nothing without attachments', () => {
        const markup = renderToStaticMarkup(
            <ChatComposerAttachmentList attachments={[]} onRemove={() => {}} />
        );

        expect(markup).toBe('');
    });
});
