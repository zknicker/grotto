import { beforeEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    acceptRunInbox,
    appendPendingInbox,
    drainPendingInbox,
    readPendingInbox,
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

test('persists busy work, dedupes notices, drains once, and removes next-run claims', async () => {
    const first = item('msg_first', '#general', 1);
    const second = item('msg_second', '#general', 2);

    await appendPendingInbox(location(), [first]);
    await appendPendingInbox(location(), [first, second]);
    expect(await readPendingInbox(location())).toEqual([first, second]);

    expect(await drainPendingInbox(location())).toEqual([first, second]);
    expect(await drainPendingInbox(location())).toEqual([]);

    await appendPendingInbox(location(), [first, second]);
    await acceptRunInbox(location(), 'run_next', [first]);
    expect(await readPendingInbox(location())).toEqual([second]);
});

test('serializes concurrent inbox writes without dropping messages', async () => {
    const items = Array.from({ length: 20 }, (_, index) =>
        item(`msg_concurrent_${index}`, '#general', index + 1)
    );
    await Promise.all(items.map(async (entry) => appendPendingInbox(location(), [entry])));
    expect(await readPendingInbox(location())).toEqual(items);
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
