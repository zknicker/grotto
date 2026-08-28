import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    readAttachmentConnectionHistory,
    recordAttachmentConnectionEvent,
} from './attachment-connection-history.ts';

test('connection history retains only the latest one hundred valid events', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-connection-history-'));
    const serverId = 'srv_history';
    try {
        for (let index = 0; index < 105; index += 1) {
            await recordAttachmentConnectionEvent(dataRoot, serverId, {
                at: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
                kind: 'disconnected',
                reason: 'socket-close',
            });
        }

        const history = await readAttachmentConnectionHistory(dataRoot, serverId);
        expect(history).toHaveLength(100);
        expect(history.at(0)?.at).toBe(new Date(Date.UTC(2026, 0, 1, 0, 0, 5)).toISOString());
        expect(history.at(-1)?.at).toBe(new Date(Date.UTC(2026, 0, 1, 0, 0, 104)).toISOString());
    } finally {
        await rm(dataRoot, { force: true, recursive: true });
    }
});
