import type { MCPClient } from '@ai-sdk/mcp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, getDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import { upsertStoredAgent } from '../tavern/agents-store.ts';
import {
    auditErrorType,
    closeAllMcpClients,
    createAgentMcpTools,
    listAllToolDefinitions,
} from './mcp-clients.ts';
import { createMcpConnection, setAgentMcpToolGrant } from './mcp-connections.ts';
import { handleMcpRequest } from './mcp-routes.ts';

const { createMcpClientMock } = vi.hoisted(() => ({
    createMcpClientMock: vi.fn(),
}));

vi.mock('@ai-sdk/mcp', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ai-sdk/mcp')>()),
    createMCPClient: createMcpClientMock,
}));

describe('MCP clients', () => {
    beforeEach(() => {
        createMcpClientMock.mockReset();
        ensureRuntimeSchema(initTestDb());
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agent-1',
                isAdmin: false,
                name: 'AgentOne',
                primaryColor: null,
                workspaceFolder: '/tmp/agent-one',
            },
        });
    });

    afterEach(async () => {
        await closeAllMcpClients();
        closeDb();
    });

    it('keeps a disconnected granted tool visible with a reconnect error', async () => {
        const connection = createMcpConnection({
            auth: 'oauth',
            name: 'Inventory',
            url: 'https://inventory.example/mcp',
        });
        if (!connection) {
            throw new Error('Connection was not created.');
        }
        setAgentMcpToolGrant({
            agentId: 'agent-1',
            connectionId: connection.id,
            enabled: true,
            toolName: 'search',
        });

        const tools = await createAgentMcpTools({ agentId: 'agent-1', turnId: 'turn-1' });
        const [tool] = Object.values(tools);

        expect(tool?.description).toContain('Reconnect it in Settings');
        await expect(tool?.execute?.({}, {} as never)).rejects.toThrow('Reconnect it in Settings');
    });

    it('rejects repeated pagination cursors', async () => {
        const client = {
            listTools: vi
                .fn()
                .mockResolvedValueOnce({ nextCursor: 'again', tools: [] })
                .mockResolvedValueOnce({ nextCursor: 'again', tools: [] }),
        } as unknown as MCPClient;

        await expect(listAllToolDefinitions(client)).rejects.toThrow('repeated tools cursor');
    });

    it('bounds the number of discovered tools', async () => {
        const client = {
            listTools: vi.fn().mockResolvedValue({
                tools: Array.from({ length: 1001 }, (_, index) => ({
                    inputSchema: { type: 'object' },
                    name: `tool-${index}`,
                })),
            }),
        } as unknown as MCPClient;

        await expect(listAllToolDefinitions(client)).rejects.toThrow('more than 1000 tools');
    });

    it('rechecks a revoked grant before a session-expiry retry executes', async () => {
        const connection = createConnectedConnection();
        const retryExecute = vi.fn();
        createMcpClientMock
            .mockResolvedValueOnce(
                fakeMcpClient({
                    execute: async () => {
                        setAgentMcpToolGrant({
                            agentId: 'agent-1',
                            connectionId: connection.id,
                            enabled: false,
                            toolName: 'search',
                        });
                        throw Object.assign(new Error('The MCP session expired.'), {
                            statusCode: 404,
                        });
                    },
                })
            )
            .mockResolvedValueOnce(fakeMcpClient({ execute: retryExecute }));
        setAgentMcpToolGrant({
            agentId: 'agent-1',
            connectionId: connection.id,
            enabled: true,
            toolName: 'search',
        });
        const tools = await createAgentMcpTools({ agentId: 'agent-1', turnId: 'turn-1' });
        const [tool] = Object.values(tools);

        await expect(tool?.execute?.({}, {} as never)).rejects.toThrow('was revoked');
        expect(retryExecute).not.toHaveBeenCalled();
    });

    it('shows a still-granted tool as unavailable when the server stops advertising it', async () => {
        const connection = createConnectedConnection();
        createMcpClientMock.mockResolvedValueOnce(fakeMcpClient({ advertiseTool: false }));
        setAgentMcpToolGrant({
            agentId: 'agent-1',
            connectionId: connection.id,
            enabled: true,
            toolName: 'search',
        });

        const tools = await createAgentMcpTools({ agentId: 'agent-1', turnId: 'turn-1' });
        const [tool] = Object.values(tools);

        expect(tool?.description).toContain('no longer advertises this tool');
        await expect(tool?.execute?.({}, {} as never)).rejects.toThrow(
            'no longer advertises this tool'
        );
    });

    it('refresh closes the cached connection before rediscovering tools', async () => {
        const connection = createConnectedConnection();
        const events: string[] = [];
        createMcpClientMock
            .mockResolvedValueOnce(fakeMcpClient({ events, label: 'cached' }))
            .mockResolvedValueOnce(fakeMcpClient({ events, label: 'refresh' }));
        setAgentMcpToolGrant({
            agentId: 'agent-1',
            connectionId: connection.id,
            enabled: true,
            toolName: 'search',
        });
        await createAgentMcpTools({ agentId: 'agent-1', turnId: 'turn-1' });
        events.length = 0;

        const response = await handleMcpRequest(
            new Request(`http://runtime.test/mcp/connections/${connection.id}/refresh`, {
                method: 'POST',
            })
        );

        expect(response?.status).toBe(200);
        expect(events.slice(0, 2)).toEqual(['cached:close', 'refresh:list']);
    });

    it('stores only an error type in audit metadata', () => {
        expect(auditErrorType(new Error('secret response body'))).toBe('Error');
        expect(auditErrorType('secret response body')).toBe('UnknownError');
    });

    it('audits a resolved MCP error result as failed without changing the result', async () => {
        const connection = createConnectedConnection();
        const result = {
            content: [{ text: 'Upstream rejected the request.', type: 'text' }],
            isError: true,
        };
        createMcpClientMock.mockResolvedValueOnce(
            fakeMcpClient({
                execute: async () => result,
            })
        );
        setAgentMcpToolGrant({
            agentId: 'agent-1',
            connectionId: connection.id,
            enabled: true,
            toolName: 'search',
        });
        const tools = await createAgentMcpTools({ agentId: 'agent-1', turnId: 'turn-error' });
        const [tool] = Object.values(tools);

        await expect(tool?.execute?.({}, {} as never)).resolves.toEqual(result);
        expect(
            getDb()
                .prepare(
                    `SELECT outcome, error FROM mcp_tool_audit
                     WHERE turn_id = 'turn-error'`
                )
                .get()
        ).toEqual({
            error: 'McpToolError',
            outcome: 'failed',
        });
    });
});

function createConnectedConnection() {
    const connection = createMcpConnection({
        auth: 'none',
        name: 'Inventory',
        url: 'https://inventory.example/mcp',
    });
    if (!connection) {
        throw new Error('Connection was not created.');
    }
    return connection;
}

function fakeMcpClient(
    input: {
        advertiseTool?: boolean;
        events?: string[];
        execute?: (...args: unknown[]) => unknown;
        label?: string;
    } = {}
) {
    const label = input.label ?? 'client';
    const execute = vi.fn(input.execute ?? (async () => ({ content: [] })));
    return {
        close: vi.fn(async () => {
            input.events?.push(`${label}:close`);
        }),
        listTools: vi.fn(async () => {
            input.events?.push(`${label}:list`);
            return {
                tools: [
                    {
                        inputSchema: { type: 'object' },
                        name: 'search',
                    },
                ],
            };
        }),
        toolsFromDefinitions: vi.fn(() =>
            input.advertiseTool === false
                ? {}
                : {
                      search: {
                          description: 'Search inventory.',
                          execute,
                          inputSchema: {},
                      },
                  }
        ),
    } as unknown as MCPClient;
}
