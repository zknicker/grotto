import { grottoReleaseSnapshotSchema } from '@grotto/api';
import type { FastifyInstance } from 'fastify';
import type { GrottoReleaseIdentity } from './grotto-release-identity.ts';

const productionSnapshotUrl = 'https://releases.grotto.sh/grotto/latest.json';
type FetchSnapshot = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function registerGrottoReleaseRoute(
    app: FastifyInstance,
    options: {
        fetchSnapshot?: FetchSnapshot;
        releaseIdentity?: GrottoReleaseIdentity | null;
        snapshotUrl?: string;
    } = {}
) {
    app.get('/api/grotto-release', async (_request, reply) => {
        const response = await readGrottoReleaseDiscovery(options);
        if (!response.ok) {
            return reply.code(502).send(response.error);
        }
        reply.header('cache-control', 'private, max-age=60');
        return response.value;
    });
}

export async function readGrottoReleaseDiscovery(options: {
    fetchSnapshot?: FetchSnapshot;
    releaseIdentity?: GrottoReleaseIdentity | null;
    snapshotUrl?: string;
}) {
    const response = await (options.fetchSnapshot ?? fetch)(
        options.snapshotUrl ?? productionSnapshotUrl
    );
    if (!response.ok) {
        return {
            error: { code: 'release_snapshot_unavailable', status: response.status },
            ok: false as const,
        };
    }
    const latest = grottoReleaseSnapshotSchema.parse(await response.json());
    return {
        ok: true as const,
        value: {
            latest,
            running: {
                agent: null,
                server: options.releaseIdentity?.serverVersion ?? null,
            },
        },
    };
}
