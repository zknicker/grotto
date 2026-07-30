import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseAgentRetireCommand, purgeRetiredAgent } from './agent-retirement.ts';

test('parses only a scoped Agent retirement command', () => {
    expect(
        parseAgentRetireCommand({
            agentId: 'agt_1234567890abcdef',
            type: 'agent-retire',
        })
    ).toEqual({ agentId: 'agt_1234567890abcdef', type: 'agent-retire' });
    expect(parseAgentRetireCommand({ agentId: '../../other', type: 'agent-retire' })).toBeNull();
});

test('retirement cleanup is idempotent and preserves standing Agent partitions', async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), 'grotto-retirement-'));
    const serverId = 'srv_1234567890abcdef';
    const retiredId = 'agt_1234567890abcdef';
    const standingId = 'agt_abcdef1234567890';
    const retiredRoot = join(dataRoot, 'servers', serverId, 'agents', retiredId);
    const standingRoot = join(dataRoot, 'servers', serverId, 'agents', standingId);
    try {
        await Promise.all([
            mkdir(join(retiredRoot, 'workspace'), { recursive: true }),
            mkdir(join(standingRoot, 'workspace'), { recursive: true }),
        ]);
        await Promise.all([
            writeFile(join(retiredRoot, 'workspace', 'MEMORY.md'), '# retired'),
            writeFile(join(standingRoot, 'workspace', 'MEMORY.md'), '# standing'),
        ]);

        await purgeRetiredAgent({ agentId: retiredId, dataRoot, serverId });
        await purgeRetiredAgent({ agentId: retiredId, dataRoot, serverId });

        await expect(stat(retiredRoot)).rejects.toThrow();
        await expect(stat(join(standingRoot, 'workspace', 'MEMORY.md'))).resolves.toBeTruthy();
    } finally {
        await rm(dataRoot, { force: true, recursive: true });
    }
});
