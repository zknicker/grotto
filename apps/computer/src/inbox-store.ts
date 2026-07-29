import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HostedAgentInboxItem } from './launch.ts';

export interface AgentInboxLocation {
    agentId: string;
    dataRoot: string;
    serverId: string;
}

const inboxWrites = new Map<string, Promise<void>>();

/** Durably accepts the run's Server-claimed inbox and removes mirrored pending copies. */
export async function acceptRunInbox(
    location: AgentInboxLocation,
    runId: string,
    items: HostedAgentInboxItem[]
): Promise<void> {
    await withInboxWrite(location, async () => {
        const root = inboxRoot(location);
        await mkdir(join(root, 'runs'), { mode: 0o700, recursive: true });
        await writeJsonAtomic(join(root, 'runs', `${runId}.json`), items);
        const pending = await readPendingInbox(location);
        const accepted = new Set(items.map((item) => item.id));
        await writeJsonAtomic(
            pendingPath(location),
            pending.filter((item) => !accepted.has(item.id))
        );
    });
}

/** Mirrors the Server's complete current busy-Agent inbox snapshot locally. */
export async function replacePendingInbox(
    location: AgentInboxLocation,
    items: HostedAgentInboxItem[]
): Promise<void> {
    await withInboxWrite(location, async () => {
        const byId = new Map<string, HostedAgentInboxItem>();
        for (const item of items) {
            byId.set(item.id, item);
        }
        await writeJsonAtomic(
            pendingPath(location),
            [...byId.values()].sort(
                (left, right) =>
                    left.createdAt.localeCompare(right.createdAt) ||
                    left.sequence - right.sequence ||
                    left.id.localeCompare(right.id)
            )
        );
    });
}

export async function readPendingInbox(
    location: AgentInboxLocation
): Promise<HostedAgentInboxItem[]> {
    try {
        const parsed = JSON.parse(await readFile(pendingPath(location), 'utf8'));
        return Array.isArray(parsed) ? (parsed as HostedAgentInboxItem[]) : [];
    } catch {
        return [];
    }
}

/** Destructively serves the current pending snapshot; a crash leaves old or new, never partial. */
export async function drainPendingInbox(
    location: AgentInboxLocation
): Promise<HostedAgentInboxItem[]> {
    return await withInboxWrite(location, async () => {
        const items = await readPendingInbox(location);
        if (items.length === 0) {
            return [];
        }
        const served = join(inboxRoot(location), `served-${randomBytes(8).toString('hex')}.json`);
        await rename(pendingPath(location), served);
        await rm(served, { force: true });
        return items;
    });
}

function inboxRoot(location: AgentInboxLocation) {
    return join(
        location.dataRoot,
        'servers',
        location.serverId,
        'agents',
        location.agentId,
        'runtime',
        'inbox'
    );
}

function pendingPath(location: AgentInboxLocation) {
    return join(inboxRoot(location), 'pending.json');
}

async function writeJsonAtomic(path: string, value: unknown) {
    await mkdir(join(path, '..'), { mode: 0o700, recursive: true });
    const temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
    await rename(temporary, path);
}

async function withInboxWrite<T>(
    location: AgentInboxLocation,
    write: () => Promise<T>
): Promise<T> {
    const key = inboxRoot(location);
    const previous = inboxWrites.get(key) ?? Promise.resolve();
    const result = previous.then(write, write);
    const settled = result.then(
        () => undefined,
        () => undefined
    );
    inboxWrites.set(key, settled);
    try {
        return await result;
    } finally {
        if (inboxWrites.get(key) === settled) {
            inboxWrites.delete(key);
        }
    }
}
