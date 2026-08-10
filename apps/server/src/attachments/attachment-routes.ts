import type { FastifyInstance, FastifyReply } from 'fastify';
import {
    ChatAccessDeniedError,
    ChatArchivedError,
    ChatNotFoundError,
} from '../chats/chat-access.ts';
import type { ClerkSessions } from '../identity/clerk-sessions.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { ServerAccessDeniedError, ServerNotFoundError } from '../servers/server-access.ts';
import { findUserByClerkId } from '../users/grotto-user.ts';
import type { AttachmentRoot } from './attachment-root.ts';
import { attachmentDisposition, openHostedAttachmentDownload } from './download-attachment.ts';
import { hostedAttachmentMaxSizeBytes } from './reserve-attachment.ts';
import { AttachmentUploadError, uploadHostedAttachment } from './upload-attachment.ts';

interface AttachmentRouteDependencies {
    clerkSessions: ClerkSessions;
    db: GrottoDatabase;
    root: AttachmentRoot;
}

interface AttachmentParams {
    attachmentId: string;
    serverId: string;
}

export async function registerAttachmentRoutes(
    app: FastifyInstance,
    dependencies: AttachmentRouteDependencies
) {
    app.get<{ Params: AttachmentParams }>(
        '/attachments/:serverId/:attachmentId',
        async (request, reply) => {
            try {
                const clerkUserId = await authenticate(
                    dependencies.clerkSessions,
                    request.headers.authorization
                );
                const member = await findUserByClerkId(dependencies.db, clerkUserId);
                const download = await openHostedAttachmentDownload(
                    dependencies.db,
                    dependencies.root,
                    member,
                    request.params
                );

                reply.headers({
                    'cache-control': 'private, no-store',
                    'content-disposition': attachmentDisposition(download.filename),
                    'content-length': download.sizeBytes,
                    'content-type': download.mediaType,
                    'x-content-type-options': 'nosniff',
                });
                return await reply.send(download.file.createReadStream());
            } catch (error) {
                return sendAttachmentError(reply, error);
            }
        }
    );

    app.put<{ Params: AttachmentParams }>(
        '/attachments/:serverId/:attachmentId',
        {
            // Consume the raw stream before Fastify's body parser can buffer it.
            onRequest: async (request, reply) => {
                try {
                    const clerkUserId = await authenticate(
                        dependencies.clerkSessions,
                        request.headers.authorization
                    );
                    requireOctetStream(request.headers['content-type']);
                    const member = await findUserByClerkId(dependencies.db, clerkUserId);
                    const declaredLength = parseContentLength(request.headers['content-length']);
                    const result = await uploadHostedAttachment(
                        dependencies.db,
                        dependencies.root,
                        {
                            attachmentId: request.params.attachmentId,
                            declaredLength,
                            member,
                            serverId: request.params.serverId,
                            stream: request.raw,
                        }
                    );

                    await reply.send(result);
                } catch (error) {
                    await sendAttachmentError(reply, error);
                }
            },
        },
        async (_request, reply) => reply
    );
}

async function authenticate(sessions: ClerkSessions, authorization: string | undefined) {
    if (!authorization?.startsWith('Bearer ')) {
        throw new RouteError('Sign in to upload attachments.', 401);
    }

    try {
        return (await sessions.verify(authorization.slice(7))).clerkUserId;
    } catch (cause) {
        throw new RouteError('Sign in to upload attachments.', 401, { cause });
    }
}

function parseContentLength(value: string | undefined) {
    if (value === undefined) {
        return null;
    }
    if (!/^(0|[1-9]\d*)$/u.test(value)) {
        throw new RouteError('Content-Length must be a nonnegative integer.', 400);
    }

    const length = Number(value);
    if (!Number.isSafeInteger(length)) {
        throw new RouteError('Content-Length is too large.', 413);
    }
    if (length > hostedAttachmentMaxSizeBytes) {
        throw new RouteError('Attachment exceeds the 50 MiB limit.', 413);
    }
    return length;
}

function requireOctetStream(value: string | undefined) {
    if (value?.toLowerCase() !== 'application/octet-stream') {
        throw new RouteError('Attachment uploads require application/octet-stream.', 415);
    }
}

function sendAttachmentError(reply: FastifyReply, error: unknown) {
    if (error instanceof RouteError) {
        return reply.code(error.status).send({ error: error.message });
    }
    if (error instanceof ChatAccessDeniedError) {
        return reply.code(403).send({ error: error.message });
    }
    if (error instanceof ServerAccessDeniedError) {
        return reply.code(403).send({ error: error.message });
    }
    if (error instanceof ChatArchivedError) {
        return reply.code(409).send({ error: error.message });
    }
    if (error instanceof ChatNotFoundError || error instanceof ServerNotFoundError) {
        return reply.code(404).send({ error: error.message });
    }
    if (error instanceof AttachmentUploadError) {
        const status = {
            conflict: 409,
            forbidden: 403,
            length_mismatch: 400,
            not_found: 404,
            size_limit: 413,
        }[error.code];
        return reply.code(status).send({ error: error.message });
    }

    requestLog(reply, error);
    return reply.code(500).send({ error: 'Attachment upload failed.' });
}

function requestLog(reply: FastifyReply, error: unknown) {
    reply.log.error(error);
}

class RouteError extends Error {
    constructor(
        message: string,
        readonly status: 400 | 401 | 413 | 415,
        options?: ErrorOptions
    ) {
        super(message, options);
    }
}
