import { afterAll, beforeAll, expect, test } from 'bun:test';
import { openAttachmentRoot } from '../src/attachments/attachment-root.ts';
import {
    type AttachmentUploadError,
    uploadAttachment,
} from '../src/attachments/upload-attachment.ts';
import { connectGrottoDatabase } from '../src/postgres/connection.ts';
import { findUserByClerkId } from '../src/users/grotto-user.ts';
import { createGrottoClient, type GrottoClient } from './grotto-client.ts';
import { type GrottoServerHarness, startGrottoServerHarness } from './grotto-server-harness.ts';

let harness: GrottoServerHarness;
let owner: GrottoClient;
let outsider: GrottoClient;
let serverId: string;
let chatId: string;

beforeAll(async () => {
    harness = await startGrottoServerHarness();
    owner = createGrottoClient(harness, await harness.clerk.mintSessionToken('upload_owner'));
    outsider = createGrottoClient(harness, await harness.clerk.mintSessionToken('upload_outsider'));
    const server = await owner.trpc.server.create.mutate({
        displayName: 'Upload Server',
        slug: 'upload-server',
    });
    serverId = server.id;
    chatId = server.channels[0].id;
});

afterAll(async () => {
    owner.close();
    outsider.close();
    await harness.close();
});

test('streams bytes to one ready attachment and makes response-loss retry idempotent', async () => {
    const reservation = await reserve(owner, 'happy-upload', 'notes.txt', 'text/plain');
    const bytes = new TextEncoder().encode('durable attachment');

    const first = await upload(owner, reservation.attachmentId, bytes);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
        attachment: {
            filename: 'notes.txt',
            id: reservation.attachmentId,
            mediaType: 'text/plain',
            sizeBytes: bytes.byteLength,
        },
        idempotent: false,
    });

    const retry = await upload(owner, reservation.attachmentId, bytes);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ idempotent: true });
    expect(
        (await upload(owner, reservation.attachmentId, new TextEncoder().encode('different')))
            .status
    ).toBe(409);

    const attachmentId = String(reservation.attachmentId);
    const [row] = (await harness.sql`
        select byte_size::int, sha256, state from attachments where id = ${attachmentId}
    `) as { byte_size: number; sha256: string; state: string }[];
    expect(row.byte_size).toBe(bytes.byteLength);
    expect(row.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(row.state).toBe('ready');
});

test('accepts missing Content-Length and rejects streamed overflow without a ready object', async () => {
    const small = await reserve(owner, 'chunked-upload', 'empty.bin', 'application/octet-stream');
    const chunked = await uploadChunked(owner, small.attachmentId, [Uint8Array.of(0)]);
    expect(chunked.status).toBe(200);
    expect(await chunked.json()).toMatchObject({
        attachment: { sizeBytes: 1 },
        idempotent: false,
    });

    const tooLarge = await reserve(
        owner,
        'overflow-upload',
        'large.bin',
        'application/octet-stream'
    );
    const connection = await connectGrottoDatabase(harness.databaseUrl);
    try {
        const member = await findUserByClerkId(connection.db, 'upload_owner');
        const root = await openAttachmentRoot(harness.attachmentRoot);
        await expect(
            uploadAttachment(connection.db, root, {
                attachmentId: tooLarge.attachmentId,
                declaredLength: null,
                member,
                serverId,
                stream: repeatedChunks(51, 1024 * 1024),
            })
        ).rejects.toEqual(
            expect.objectContaining<Partial<AttachmentUploadError>>({ code: 'size_limit' })
        );
    } finally {
        await connection.close();
    }

    const attachmentId = String(tooLarge.attachmentId);
    const [row] = (await harness.sql`
            select failure_code, state from attachments where id = ${attachmentId}
        `) as { failure_code: string; state: string }[];
    expect(row).toEqual({ failure_code: 'size_limit', state: 'failed' });

    const inventory = await owner.trpc.attachment.inventory.query({ serverId });
    const failed = inventory.attachments.find(
        (attachment) => attachment.attachmentId === tooLarge.attachmentId
    );
    expect(failed).toMatchObject({
        expectedStagingKey: expect.any(String),
        state: 'failed',
    });
    expect(inventory.objectKeys).not.toContain(failed?.expectedObjectKey);
    expect(inventory.stagingKeys).not.toContain(failed?.expectedStagingKey);
}, 20_000);

test('upload fails closed for a foreign member and foreign Server id', async () => {
    const reservation = await reserve(owner, 'foreign-upload', 'private.txt', 'text/plain');

    expect((await upload(outsider, reservation.attachmentId, new Uint8Array())).status).toBe(403);
    expect(
        (await upload(owner, reservation.attachmentId, new Uint8Array(), 'srv_1234567890abcdef'))
            .status
    ).toBe(404);
    const invalidType = await fetch(
        new URL(`/attachments/${serverId}/${reservation.attachmentId}`, harness.url),
        {
            body: new Uint8Array(),
            headers: {
                authorization: `Bearer ${owner.clerkSessionToken}`,
                'content-type': 'text/plain',
                origin: harness.appOrigin,
            },
            method: 'PUT',
        }
    );
    expect(invalidType.status).toBe(415);
});

test('accepts zero bytes and marks a dishonest Content-Length attempt failed', async () => {
    const empty = await reserve(owner, 'zero-upload', 'zero.bin', 'application/octet-stream');
    const zero = await upload(owner, empty.attachmentId, new Uint8Array());
    expect(zero.status).toBe(200);
    expect(await zero.json()).toMatchObject({ attachment: { sizeBytes: 0 } });

    const partial = await reserve(
        owner,
        'partial-upload',
        'partial.bin',
        'application/octet-stream'
    );
    const connection = await connectGrottoDatabase(harness.databaseUrl);
    try {
        const member = await findUserByClerkId(connection.db, 'upload_owner');
        const root = await openAttachmentRoot(harness.attachmentRoot);
        await expect(
            uploadAttachment(connection.db, root, {
                attachmentId: partial.attachmentId,
                declaredLength: 2,
                member,
                serverId,
                stream: chunkBody([Uint8Array.of(1)]),
            })
        ).rejects.toEqual(
            expect.objectContaining<Partial<AttachmentUploadError>>({ code: 'length_mismatch' })
        );
    } finally {
        await connection.close();
    }

    const attachmentId = String(partial.attachmentId);
    const [row] = (await harness.sql`
        select failure_code, state from attachments where id = ${attachmentId}
    `) as { failure_code: string; state: string }[];
    expect(row).toEqual({ failure_code: 'length_mismatch', state: 'failed' });
});

async function reserve(client: GrottoClient, nonce: string, filename: string, mediaType: string) {
    return await client.trpc.attachment.reserve.mutate({
        chatId,
        filename,
        mediaType,
        nonce,
        serverId,
    });
}

async function upload(
    client: GrottoClient,
    attachmentId: string,
    body: Bun.BodyInit,
    scopedServerId = serverId
) {
    return await fetch(new URL(`/attachments/${scopedServerId}/${attachmentId}`, harness.url), {
        body,
        headers: {
            authorization: `Bearer ${client.clerkSessionToken}`,
            'content-type': 'application/octet-stream',
            origin: harness.appOrigin,
        },
        method: 'PUT',
    });
}

async function uploadChunked(client: GrottoClient, attachmentId: string, chunks: Uint8Array[]) {
    return await upload(client, attachmentId, chunkBody(chunks));
}

async function* chunkBody(chunks: Uint8Array[]) {
    for (const chunk of chunks) {
        yield chunk;
    }
}

async function* repeatedChunks(count: number, size: number) {
    const chunk = new Uint8Array(size);
    for (let index = 0; index < count; index += 1) {
        yield chunk;
    }
}
