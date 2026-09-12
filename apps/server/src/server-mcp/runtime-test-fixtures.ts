import type { MCPClient } from '@ai-sdk/mcp';
import type { HausDatabase } from '../postgres/connection.ts';
import type { McpRuntime } from './runtime.ts';
import { modelToolName } from './tool-catalog.ts';

interface RequestOptions {
    signal?: AbortSignal;
    timeout?: number;
}
type ListRequest = { options?: RequestOptions; params?: { cursor?: string } } | undefined;
interface ClientPlan {
    call?: (request: { options?: RequestOptions }) => Promise<unknown>;
    list?: (request: ListRequest) => Promise<unknown>;
}

export function fakeQuery(rows: unknown[]) {
    const query = Promise.resolve(rows) as unknown as Record<string, () => unknown>;
    query.from = query.innerJoin = query.where = () => query;
    query.limit = () => Promise.resolve(rows);
    return query;
}

export function makeClient(name: string, plan: ClientPlan = {}) {
    const state = {
        callRequests: [] as { options?: RequestOptions }[],
        closeCount: 0,
        listRequests: [] as ListRequest[],
    };
    const client = {
        callTool(request: { options?: RequestOptions }) {
            state.callRequests.push(request);
            return (
                plan.call?.(request) ?? Promise.resolve({ content: [{ text: 'ok', type: 'text' }] })
            );
        },
        close: async () => {
            state.closeCount += 1;
        },
        instructions: 'Fixture instructions',
        listTools(request?: ListRequest) {
            state.listRequests.push(request);
            return (
                plan.list?.(request) ??
                Promise.resolve({ tools: [{ description: 'Echo', inputSchema: {}, name: 'echo' }] })
            );
        },
        serverInfo: { name, version: '1.0.0' },
    } as unknown as MCPClient;
    return { client, state };
}

export function grantDb(connectionId: string, toolName: string, grant = true): HausDatabase {
    let selection = 0;
    return {
        select() {
            if (selection++ === 0) {
                return fakeQuery([{ id: connectionId, name: 'Fixture', tools: [toolName] }]);
            }
            return fakeQuery(grant ? [{ connectionId }] : []);
        },
    } as unknown as HausDatabase;
}

export const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function invoke(runtime: McpRuntime, connectionId: string, args: unknown = {}) {
    return runtime.invoke({
        agentId: 'agent-one',
        args,
        serverId: 'server-one',
        toolName: modelToolName(connectionId, 'echo'),
    });
}
