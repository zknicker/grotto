import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { isPreviewableImage, MessageAttachments } from './message-attachments.tsx';

const imageAttachment = {
    filename: 'orbit.png',
    id: 'attachment_image',
    mediaType: 'image/png',
    sizeBytes: 159_700,
};

test('hosted image attachments render as media thumbnails with a download action', () => {
    const markup = renderToStaticMarkup(
        <MessageAttachments
            attachments={[imageAttachment]}
            disabled={false}
            onDownload={() => undefined}
            serverId="server_one"
        />
    );

    expect(markup).toContain('data-variant="media"');
    expect(markup).toContain('alt="orbit.png"');
    expect(markup).toContain('aria-label="Download orbit.png"');
});

test('non-image attachments keep the file-card presentation', () => {
    const markup = renderToStaticMarkup(
        <MessageAttachments
            attachments={[
                { ...imageAttachment, filename: 'notes.pdf', mediaType: 'application/pdf' },
            ]}
            disabled={false}
            onDownload={() => undefined}
            serverId="server_one"
        />
    );

    expect(markup).toContain('data-slot="attachment"');
    expect(markup).not.toContain('data-variant="media"');
    expect(markup).toContain('application/pdf');
});

test('all image media types select the preview path', () => {
    expect(isPreviewableImage(imageAttachment)).toBe(true);
    expect(isPreviewableImage({ ...imageAttachment, mediaType: 'text/plain' })).toBe(false);
});
