import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatComposerAttachmentList } from './chat-composer-attachments.tsx';
import { hasFileTransfer } from './chat-composer-file-drop.ts';

test('detects file drag transfers', () => {
    expect(hasFileTransfer({ types: ['Files'] })).toBe(true);
    expect(hasFileTransfer({ types: ['text/plain'] })).toBe(false);
});

describe('ChatComposerAttachmentList', () => {
    test('renders image attachments as compact tray tiles', () => {
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

        expect(markup).toContain('flex-wrap');
        expect(markup.match(/size-20/g)).toHaveLength(2);
        expect(markup).toContain('Remove first.png');
        expect(markup).toContain('bg-primary');
        expect(markup).toContain('text-primary-foreground');
        expect(markup).not.toContain('flex-col');
    });

    test('renders non-image attachments as square preview tiles', () => {
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

        expect(markup).toContain('size-20');
        expect(markup).toContain('Remove notes.md');
        expect(markup).toContain('notes.md');
        expect(markup).not.toContain('w-full');
        expect(markup).not.toContain('w-44');
    });
});
