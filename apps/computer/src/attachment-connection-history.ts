import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const connectionEventSchema = z.discriminatedUnion('kind', [
    z.object({ at: z.string().datetime(), kind: z.literal('connected') }).strict(),
    z
        .object({
            at: z.string().datetime(),
            kind: z.literal('disconnected'),
            reason: z.enum(['heartbeat-timeout', 'socket-close', 'socket-error']),
        })
        .strict(),
]);

export type AttachmentConnectionEvent = z.infer<typeof connectionEventSchema>;

const retainedEventCount = 100;
export const reconnectStormWindowMs = 5 * 60_000;
export const reconnectStormThreshold = 5;

export async function recordAttachmentConnectionEvent(
    dataRoot: string,
    serverId: string,
    event: AttachmentConnectionEvent
) {
    const root = connectionHistoryRoot(dataRoot, serverId);
    await mkdir(root, { mode: 0o700, recursive: true });
    const name = `${Date.parse(event.at).toString().padStart(16, '0')}-${randomUUID()}.json`;
    await writeFile(join(root, name), `${JSON.stringify(event)}\n`, { mode: 0o600 });
    const entries = (await readdir(root)).sort();
    await Promise.all(
        entries.slice(0, -retainedEventCount).map((entry) => rm(join(root, entry), { force: true }))
    );
}

export async function readAttachmentConnectionHistory(dataRoot: string, serverId: string) {
    const root = connectionHistoryRoot(dataRoot, serverId);
    const entries = (await readdir(root).catch(() => [])).sort().slice(-retainedEventCount);
    const events = await Promise.all(
        entries.map(async (entry) => {
            try {
                const parsed = connectionEventSchema.safeParse(
                    JSON.parse(await readFile(join(root, entry), 'utf8'))
                );
                return parsed.success ? parsed.data : null;
            } catch {
                return null;
            }
        })
    );
    return events.filter((event): event is AttachmentConnectionEvent => event !== null);
}

export function recentDisconnectCount(events: AttachmentConnectionEvent[], now = Date.now()) {
    const cutoff = now - reconnectStormWindowMs;
    return events.filter((event) => event.kind === 'disconnected' && Date.parse(event.at) >= cutoff)
        .length;
}

function connectionHistoryRoot(dataRoot: string, serverId: string) {
    return join(dataRoot, 'servers', serverId, 'connection-history');
}
