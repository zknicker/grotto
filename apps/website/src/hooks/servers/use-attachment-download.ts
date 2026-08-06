import { useMutation } from '@tanstack/react-query';
import { getClerkSessionToken } from '../../lib/clerk.tsx';
import { getGrottoServerOrigin } from '../../lib/grotto-server.tsx';

export function useAttachmentDownload() {
    return useMutation({
        mutationFn: async ({
            attachmentId,
            filename,
            serverId,
        }: {
            attachmentId: string;
            filename: string;
            serverId: string;
        }) => {
            const token = await getClerkSessionToken();
            if (!token) {
                throw new Error('Sign in to download attachments.');
            }

            const response = await fetch(
                new URL(`/attachments/${serverId}/${attachmentId}`, getGrottoServerOrigin()),
                { headers: { authorization: `Bearer ${token}` } }
            );
            if (!response.ok) {
                throw new Error('Could not download that attachment.');
            }

            saveBlob(await response.blob(), filename);
        },
    });
}

function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = filename;
    anchor.href = url;
    anchor.click();
    URL.revokeObjectURL(url);
}
