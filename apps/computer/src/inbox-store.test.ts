import { beforeEach, expect, test } from 'bun:test';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { noticePath, writePendingNotice } from './delivery.ts';
import {
    acceptRunInbox,
    consumeVisibleMessages,
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

test('mirrors the latest busy snapshot and removes next-run claims', async () => {
    const first = item('msg_first', '#general', 1);
    const second = item('msg_second', '#general', 2);

    await replacePendingInbox(location(), [first, second]);
    expect(await readPendingInbox(location())).toEqual([first, second]);

    await replacePendingInbox(location(), [second]);
    expect(await readPendingInbox(location())).toEqual([second]);

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

test('accepting a DM greeting removes its stale busy notice before the resumed turn', async () => {
    const greeting = item('msg_greeting', 'dm:@operator', 2);
    await replacePendingInbox(location(), [greeting]);
    await writePendingNotice(dataRoot, {
        agentId: location().agentId,
        notice: '[Grotto inbox notice:\nInbox update: 1 unread messages total; 1 changed target(s)\ndm:@operator pending: 1 message(s)\n]',
        serverId: location().serverId,
    });

    await acceptRunInbox(location(), 'run_greeting', [greeting]);

    await expect(
        access(noticePath(dataRoot, { agentId: location().agentId, serverId: location().serverId }))
    ).rejects.toMatchObject({ code: 'ENOENT' });
});

test('consuming exact visible identities preserves unrelated pending work', async () => {
    const greeting = item('msg_greeting', 'dm:@operator', 2);
    const productTask = item('msg_product', '#product', 3);
    await replacePendingInbox(location(), [greeting, productTask]);

    await consumeVisibleMessages(location(), [greeting]);

    expect(await readPendingInbox(location())).toEqual([productTask]);
    expect(
        await Bun.file(
            noticePath(dataRoot, {
                agentId: location().agentId,
                serverId: location().serverId,
            })
        ).json()
    ).toMatchObject({ notice: expect.stringContaining('#product pending: 1 message(s)') });
});

test('does not resurrect a consumed identity from a stale notice snapshot', async () => {
    const greeting = item('msg_greeting', 'dm:@operator', 2);
    const productTask = item('msg_product', '#product', 3);

    await consumeVisibleMessages(location(), [greeting]);
    await replacePendingInbox(location(), [greeting, productTask]);

    expect(await readPendingInbox(location())).toEqual([productTask]);
});

test('retains a visible identity omitted from a bounded notice window', async () => {
    const firstWindow = Array.from({ length: 50 }, (_, index) =>
        item(`msg_${index + 1}`, '#product', index + 1)
    );
    const omitted = item('msg_51', '#product', 51);

    await consumeVisibleMessages(location(), [omitted]);
    await replacePendingInbox(location(), firstWindow, 51);
    await replacePendingInbox(location(), [omitted], 1);

    expect(await readPendingInbox(location())).toEqual([]);
});

test('serializes live notice delivery with accepted-run consumption', async () => {
    const greeting = item('msg_greeting', 'dm:@operator', 2);
    let releaseDelivery: (() => void) | undefined;
    const deliveryStarted = Promise.withResolvers<void>();
    const deliveryReleased = new Promise<void>((resolve) => {
        releaseDelivery = resolve;
    });
    const delivered: string[] = [];

    const replacement = replacePendingInbox(location(), [greeting], 1, async (notice) => {
        delivered.push(notice);
        deliveryStarted.resolve();
        await deliveryReleased;
    });
    await deliveryStarted.promise;
    const acceptance = acceptRunInbox(location(), 'run_greeting', [greeting]);

    expect(
        await Promise.race([acceptance.then(() => 'accepted'), Promise.resolve('waiting')])
    ).toBe('waiting');
    releaseDelivery?.();
    await Promise.all([replacement, acceptance]);

    expect(delivered).toHaveLength(1);
    expect(await readPendingInbox(location())).toEqual([]);
    await expect(
        access(noticePath(dataRoot, { agentId: location().agentId, serverId: location().serverId }))
    ).rejects.toMatchObject({ code: 'ENOENT' });
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
