import * as React from 'react';
import { fetchAttachmentBlob } from './attachment-bytes.ts';

export function useAttachmentPreview({
    attachmentId,
    serverId,
}: {
    attachmentId: string;
    serverId: string;
}) {
    const [preview, setPreview] = React.useState<{
        failed: boolean;
        url: string | null;
    }>({ failed: false, url: null });

    React.useEffect(() => {
        const controller = new AbortController();
        let objectUrl: string | null = null;

        fetchAttachmentBlob({ attachmentId, serverId, signal: controller.signal })
            .then((blob) => {
                if (controller.signal.aborted) {
                    return;
                }
                objectUrl = URL.createObjectURL(blob);
                setPreview({ failed: false, url: objectUrl });
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setPreview({ failed: true, url: null });
                }
            });

        return () => {
            controller.abort();
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [attachmentId, serverId]);

    return preview;
}
