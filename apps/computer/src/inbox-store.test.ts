import { beforeEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    acceptRunInbox,
    drainPendingInbox,
    readPendingInbox,
    replacePendingInbox,
} from './inbox-store.ts';
import type { HostedAgentInboxItem } from './launch.ts';

let dataRoot: string;
const location = () => ({
    agentId: 'agt_inbox',
    dataRoot,
    serverId: 'srv_inbox',
});

beforeEach(async () => {
    if (dataRoot) {
        await rm(dataRoot, { force: true, recursive: true });
    }
    dataRoot = await mkdtemp(join(tmpdir(), 'grotto-inbox-'));
});

test('mirrors the latest busy snapshot, drains once, and removes next-run claims', async () => {
    const first = item('msg_first', '#general', 1);
    const second = item('msg_second', '#general', 2);

    await replacePendingInbox(location(), [first, second]);
    expect(await readPendingInbox(location())).toEqual([first, second]);

    await replacePendingInbox(location(), [second]);
    expect(await readPendingInbox(location())).toEqual([second]);

    expect(await drainPendingInbox(location())).toEqual([second]);
    expect(await drainPendingInbox(location())).toEqual([]);

    await replacePendingInbox(location(), [first, second]);
    await acceptRunInbox(location(), 'run_next', [first]);
    expect(await readPendingInbox(location())).toEqual([second]);
});

test('dedupes and orders a replacement snapshot', async () => {
    const first = item('msg_first', '#general', 1);
    const second = item('msg_second', '#general', 2);
    await replacePendingInbox(location(), [second, first, second]);
    expect(await readPendingInbox(location())).toEqual([first, second]);
});

function item(id: string, target: string, sequence: number): HostedAgentInboxItem {
    return {
        chatId: 'cht_inbox',
        content: `message ${sequence}`,
        createdAt: new Date(Date.UTC(2026, 6, 27, 0, 0, sequence)).toISOString(),
        id,
        senderHandle: 'operator',
        senderType: 'human',
        sequence,
        target,
    };
}
