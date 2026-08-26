import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { preparedActionMediaTable } from '../postgres/schema.ts';

export const preparedActionMediaRoutePrefix = '/api/prepared-action-media';

export function preparedActionMediaUrlFor(mediaId: string) {
    return `${preparedActionMediaRoutePrefix}/${mediaId}`;
}

export function registerPreparedActionMediaRoutes(
    app: FastifyInstance,
    dependencies: { db: GrottoDatabase }
) {
    app.get<{ Params: { mediaId: string } }>(
        `${preparedActionMediaRoutePrefix}/:mediaId`,
        async (request, reply) => {
            if (!/^pam_[A-Za-z0-9_-]{16}$/u.test(request.params.mediaId)) {
                return await reply.code(404).send({ error: 'No prepared action media exists.' });
            }

            const [media] = await dependencies.db
                .select({
                    byteSize: preparedActionMediaTable.byteSize,
                    bytes: preparedActionMediaTable.bytes,
                    mediaType: preparedActionMediaTable.mediaType,
                })
                .from(preparedActionMediaTable)
                .where(eq(preparedActionMediaTable.id, request.params.mediaId))
                .limit(1);

            if (!media) {
                return await reply.code(404).send({ error: 'No prepared action media exists.' });
            }

            reply.headers({
                'cache-control': 'public, max-age=31536000, immutable',
                'content-length': media.byteSize,
                'content-type': media.mediaType,
                'x-content-type-options': 'nosniff',
            });
            return await reply.send(Buffer.from(media.bytes));
        }
    );
}
