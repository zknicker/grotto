import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { noticePath, writePendingNotice } from './delivery.ts';
import { composeInboxNotice } from './inbox-format.ts';
import type { HostedAgentInboxItem } from './launch.ts';

export interface AgentInboxLocation {
    agentId: string;
    dataRoot: string;
    serverId: string;
}

export interface VisibleMessageIdentity {
    chatId: string;
    id: string;
    sequence: number;
}

interface PendingInboxState {
    consumedMessageIds: string[];
    items: HostedAgentInboxItem[];
    totalPending: number;
}

const inboxWrites = new Map<string, Promise<void>>();

/** Accepts a concrete run and reconciles its rows out of the busy-notice mirror. */
export async function acceptRunInbox(
    location: AgentInboxLocation,
    runId: string,
    items: HostedAgentInboxItem[]
): Promise<void> {
    await withInboxWrite(location, async () => {
        const root = inboxRoot(location);
        await mkdir(join(root, 'runs'), { mode: 0o700, recursive: true });
        await writeJsonAtomic(join(root, 'runs', `${runId}.json`), items);
        await consumeVisibleMessagesLocked(location, items);
    });
}

/** Mirrors the Server's current bounded busy-Agent inbox window locally. */
export async function replacePendingInbox(
    location: AgentInboxLocation,
    items: HostedAgentInboxItem[],
    totalPending = items.length,
    deliverNotice?: (notice: string) => Promise<void>
): Promise<string | null> {
    return await withInboxWrite(location, async () => {
        const current = await readPendingState(location);
        const consumed = new Set(current.consumedMessageIds);
        const byId = new Map<string, HostedAgentInboxItem>();
        for (const item of items) {
            if (!consumed.has(item.id)) {
                byId.set(item.id, item);
            }
        }
        const pending = [...byId.values()].sort(
            (left, right) =>
                left.createdAt.localeCompare(right.createdAt) ||
                left.sequence - right.sequence ||
                left.id.localeCompare(right.id)
        );
        const visibleInSnapshot = new Set(
            items.filter((item) => consumed.has(item.id)).map((item) => item.id)
        ).size;
        const nextTotal = Math.max(pending.length, totalPending - visibleInSnapshot);
        await writePendingState(location, {
            consumedMessageIds: current.consumedMessageIds,
            items: pending,
            totalPending: nextTotal,
        });
        const notice = await reconcilePendingNotice(location, pending, nextTotal);
        if (notice && deliverNotice) {
            await deliverNotice(notice);
        }
        return notice;
    });
}

export async function readPendingInbox(
    location: AgentInboxLocation
): Promise<HostedAgentInboxItem[]> {
    try {
        return (await readPendingState(location)).items;
    } catch {
        return [];
    }
}

/**
 * The single Computer-local consume point for messages that became model-visible.
 * Every visibility path removes exact identities from the pending notice projection.
 */
export async function consumeVisibleMessages(
    location: AgentInboxLocation,
    messages: Iterable<VisibleMessageIdentity>
): Promise<void> {
    const visible = [...messages];
    if (visible.length === 0) {
        return;
    }
    await withInboxWrite(location, async () => {
        await consumeVisibleMessagesLocked(location, visible);
    });
}

async function readPendingState(location: AgentInboxLocation): Promise<PendingInboxState> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(await readFile(pendingPath(location), 'utf8'));
    } catch (error) {
        if (isMissingFile(error)) {
            return { consumedMessageIds: [], items: [], totalPending: 0 };
        }
        throw error;
    }
    if (Array.isArray(parsed)) {
        return {
            consumedMessageIds: [],
            items: parsed as HostedAgentInboxItem[],
            totalPending: parsed.length,
        };
    }
    if (!(parsed && typeof parsed === 'object')) {
        throw new Error('Invalid local Agent inbox state.');
    }
    const record = parsed as Record<string, unknown>;
    if (
        (record.consumedMessageIds === undefined || Array.isArray(record.consumedMessageIds)) &&
        Array.isArray(record.items) &&
        Number.isInteger(record.totalPending)
    ) {
        return {
            consumedMessageIds: record.consumedMessageIds ?? [],
            items: record.items,
            totalPending: record.totalPending,
        } as PendingInboxState;
    }
    throw new Error('Invalid local Agent inbox state.');
}

async function consumeVisibleMessagesLocked(
    location: AgentInboxLocation,
    visible: VisibleMessageIdentity[]
): Promise<void> {
    const state = await readPendingState(location);
    const visibleIds = new Set(visible.map((message) => message.id));
    const remaining = state.items.filter((item) => !visibleIds.has(item.id));
    const consumed = state.items.length - remaining.length;
    const existingConsumed = new Set(state.consumedMessageIds);
    const hasNewVisible = [...visibleIds].some((id) => !existingConsumed.has(id));
    const consumedMessageIds = [...new Set([...state.consumedMessageIds, ...visibleIds])];
    if (consumed === 0 && !hasNewVisible) {
        return;
    }
    const next = {
        consumedMessageIds,
        items: remaining,
        totalPending: Math.max(remaining.length, state.totalPending - consumed),
    };
    await writePendingState(location, next);
    await reconcilePendingNotice(location, next.items, next.totalPending);
}

async function writePendingState(
    location: AgentInboxLocation,
    state: PendingInboxState
): Promise<void> {
    await writeJsonAtomic(pendingPath(location), state);
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

async function reconcilePendingNotice(
    location: AgentInboxLocation,
    items: HostedAgentInboxItem[],
    totalPending = items.length
): Promise<string | null> {
    const notice = composeInboxNotice(items, totalPending);
    if (!notice) {
        await rm(noticePath(location.dataRoot, location), { force: true });
        return null;
    }
    await writePendingNotice(location.dataRoot, {
        agentId: location.agentId,
        notice,
        serverId: location.serverId,
    });
    return notice;
}

async function writeJsonAtomic(path: string, value: unknown) {
    await mkdir(join(path, '..'), { mode: 0o700, recursive: true });
    const temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600 });
    await rename(temporary, path);
}

function isMissingFile(error: unknown): boolean {
    return (
        error instanceof Error &&
        'code' in error &&
        (error as Error & { code?: string }).code === 'ENOENT'
    );
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
