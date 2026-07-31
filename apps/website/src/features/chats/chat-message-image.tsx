import * as React from 'react';
import { ImageLightbox } from '../../components/chats/image-lightbox.tsx';

interface ChatMessageImageAttachment {
    dataBase64: string;
    filename: string;
    height?: number | null;
    mediaType: string;
    width?: number | null;
}

export function ChatMessageImage({ attachment }: { attachment: ChatMessageImageAttachment }) {
    const [open, setOpen] = React.useState(false);
    const dataUrl = `data:${attachment.mediaType};base64,${attachment.dataBase64}`;

    return (
        <>
            <button
                aria-label={`Open ${attachment.filename}`}
                className="size-16 cursor-zoom-in overflow-hidden rounded-xl border border-separator bg-surface-secondary p-0 text-left outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setOpen(true)}
                title={attachment.filename}
                type="button"
            >
                <img
                    alt=""
                    className="size-full object-cover"
                    height={64}
                    src={dataUrl}
                    width={64}
                />
            </button>
            <ImageLightbox
                dataUrl={dataUrl}
                filename={attachment.filename}
                height={attachment.height}
                onOpenChange={setOpen}
                open={open}
                width={attachment.width}
            />
        </>
    );
}
