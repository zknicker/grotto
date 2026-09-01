import { getClerkSessionToken } from '../../lib/clerk.tsx';
import { getGrottoServerOrigin } from '../../lib/grotto-server.tsx';

export async function fetchAttachmentBlob({
    attachmentId,
    serverId,
    signal,
}: {
    attachmentId: string;
    serverId: string;
    signal?: AbortSignal;
}) {
    const token = await getClerkSessionToken();
    if (!token) {
        throw new Error('Sign in to download attachments.');
    }

    const response = await fetch(
        new URL(`/attachments/${serverId}/${attachmentId}`, getGrottoServerOrigin()),
        {
            headers: { authorization: `Bearer ${token}` },
            signal,
        }
    );
    if (!response.ok) {
        throw new Error('Could not download that attachment.');
    }

    return response.blob();
}

export function saveAttachmentBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = filename;
    anchor.href = url;
    anchor.click();
    URL.revokeObjectURL(url);
}
