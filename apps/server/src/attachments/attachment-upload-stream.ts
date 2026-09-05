import { createHash } from 'node:crypto';
import type { AttachmentRoot } from './attachment-root.ts';
import { AttachmentUploadError } from './attachment-upload-model.ts';
import { attachmentMaxSizeBytes } from './reserve-attachment.ts';

export async function streamAttachmentToFile(
    file: Awaited<ReturnType<AttachmentRoot['createStagingFile']>>,
    stream: AsyncIterable<Uint8Array>
) {
    return await digestAttachmentStream(stream, async (chunk) => {
        await file.write(chunk);
    });
}

export async function digestAttachmentStream(
    stream: AsyncIterable<Uint8Array>,
    onChunk?: (chunk: Buffer) => Promise<void>
) {
    const hash = createHash('sha256');
    let sizeBytes = 0;

    for await (const rawChunk of stream) {
        const chunk = Buffer.from(rawChunk);
        sizeBytes += chunk.byteLength;
        if (sizeBytes > attachmentMaxSizeBytes) {
            throw new AttachmentUploadError('Attachment exceeds the 50 MiB limit.', 'size_limit');
        }
        hash.update(chunk);
        await onChunk?.(chunk);
    }

    return { sha256: hash.digest('hex'), sizeBytes };
}
