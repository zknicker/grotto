import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AttachmentMcpRuntime } from './mcp-runtime.ts';

const connectionId = 'mcp_1234567890123456';
const agentId = 'agt_attachment_test';
const fixture = fileURLToPath(new URL('./test-fixtures/deterministic-mcp.ts', import.meta.url));
let root: string;
let runtime: AttachmentMcpRuntime;

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'grotto-mcp-'));
    runtime = new AttachmentMcpRuntime(join(root, 'attachment-a'));
    await runtime.upsert({
        args: [fixture],
        command: process.execPath,
        env: { MCP_PREFIX: 'attachment-a' },
        headers: {},
        id: connectionId,
        name: 'Deterministic',
        url: null,
    });
});

afterEach(async () => {
    await runtime.close();
    await rm(root, { force: true, recursive: true });
});

test('invokes only an exactly granted tool from the attachment-local MCP session', async () => {
    expect(await runtime.listTools(connectionId)).toEqual(['echo']);
    runtime.replaceAgentGrants(agentId, [{ agentId, connectionId, toolName: 'echo' }]);

    const result = await runtime.invoke({
        agentId,
        args: { value: 'allowed' },
        connectionId,
        toolName: 'echo',
    });
    expect(result).toMatchObject({
        content: [{ text: 'attachment-a:allowed', type: 'text' }],
    });

    await expect(
        runtime.invoke({
            agentId,
            args: {},
            connectionId,
            toolName: 'not-granted',
        })
    ).rejects.toThrow('not granted');

    runtime.replaceAgentGrants(agentId, []);
    await expect(
        runtime.invoke({ agentId, args: {}, connectionId, toolName: 'echo' })
    ).rejects.toThrow('not granted');
});

test('the same grant cannot resolve a connection from another attachment', async () => {
    const other = new AttachmentMcpRuntime(join(root, 'attachment-b'));
    other.replaceAgentGrants(agentId, [{ agentId, connectionId, toolName: 'echo' }]);
    await expect(
        other.invoke({ agentId, args: {}, connectionId, toolName: 'echo' })
    ).rejects.toThrow('does not belong to this attachment');
    await other.close();

    expect((await stat(join(root, 'attachment-a', `${connectionId}.json`))).mode & 0o777).toBe(
        0o600
    );
});
