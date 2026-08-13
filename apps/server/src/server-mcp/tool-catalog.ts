import { createHash } from 'node:crypto';
import type { MCPClient } from '@ai-sdk/mcp';

export function modelToolName(connectionId: string, toolName: string) {
    const slug = (value: string) =>
        value.replace(/[^a-zA-Z0-9_-]+/gu, '_').replace(/^_+|_+$/gu, '') || 'tool';
    const hash = createHash('sha256')
        .update(`${connectionId}\0${toolName}`)
        .digest('hex')
        .slice(0, 8);
    return `mcp__${slug(connectionId).slice(0, 20)}__${slug(toolName).slice(0, 27)}_${hash}`;
}

export async function listAllTools(client: MCPClient) {
    const tools: Awaited<ReturnType<MCPClient['listTools']>>['tools'] = [];
    const seenCursors = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 100; page += 1) {
        const result = await client.listTools({ params: { cursor } });
        tools.push(...result.tools);
        if (tools.length > 1000) {
            throw new Error('MCP tool discovery exceeded 1,000 tools.');
        }
        if (!result.nextCursor) {
            return tools;
        }
        if (seenCursors.has(result.nextCursor)) {
            throw new Error('MCP tool discovery returned a repeated cursor.');
        }
        seenCursors.add(result.nextCursor);
        cursor = result.nextCursor;
    }
    throw new Error('MCP tool discovery exceeded 100 pages.');
}
