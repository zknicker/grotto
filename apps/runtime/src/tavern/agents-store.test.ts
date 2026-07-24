import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasAgentHostToolGrant, setAgentHostToolGrant } from '../agent-engine/host-tools.ts';
import { setRuntimeSkillEnabled } from '../agent-engine/skill-library.ts';
import { closeDb, initTestDb } from '../db/connection.ts';
import { ensureRuntimeSchema } from '../db/schema.ts';
import {
    clearClaudeCredentials,
    saveClaudeOAuthCredentials,
} from '../model-access/claude-settings.ts';
import { setModelProviderEnabled } from '../models/provider-store.ts';
import { getStoredAgent, updateStoredAgent, upsertStoredAgent } from './agents-store.ts';
import { getChat } from './chat-api/index.ts';
import { handleTavernRuntimeRequest } from './router.ts';

describe('Runtime agent and agent engine reads', () => {
    const originalFetch = globalThis.fetch;
    const originalClaudeCommand = process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND;

    beforeEach(() => {
        ensureRuntimeSchema(initTestDb());
        // Claude models are executable only with stored credentials now.
        saveClaudeOAuthCredentials({
            accessToken: 'sk-ant-test',
            expiresAt: null,
            refreshToken: null,
        });
        globalThis.fetch = vi.fn(handleAgentEngineFetch) as unknown as typeof fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        restoreEnv('TAVERN_AGENT_CLAUDE_CODE_COMMAND', originalClaudeCommand);
        closeDb();
    });

    it('lists no agents on a fresh runtime — nothing is lazily bootstrapped', async () => {
        // ADR 0018: agents exist only when created through the create path
        // (app, demo seeding, or the server's shipped-default bootstrap).
        const response = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents')
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ agents: [] });
    });

    it('creates agents with the default seeded skills through the create path', async () => {
        const createResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents', {
                body: JSON.stringify({
                    id: 'agt_otto_00000001',
                    isAdmin: true,
                    name: 'Otto',
                    workspaceFolder: '/tmp/tavern-otto-workspace',
                }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            })
        );

        expect(createResponse.status).toBe(200);
        await expect(createResponse.json()).resolves.toMatchObject({
            webAccessEnabled: false,
            // The pre-flip `tasks` skill left the seeded defaults (WS8): its
            // content teaches the retired tasks_* tool surface.
            enabledSkillIds: ['tavern-agent', 'visuals'],
            id: 'agt_otto_00000001',
            isAdmin: true,
            modelName: {
                model: 'gpt-4.1-mini',
                provider: 'openai',
            },
            name: 'Otto',
        });
    });

    it('creates and lists multiple Runtime-managed agents', async () => {
        const createResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents', {
                body: JSON.stringify({
                    enabledSkillIds: ['research'],
                    id: 'agt_research',
                    name: 'Research',
                    primaryColor: '#2563eb',
                    workspaceFolder: '/tmp/tavern-research-workspace',
                }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            })
        );

        expect(createResponse.status).toBe(200);
        await expect(createResponse.json()).resolves.toMatchObject({
            enabledSkillIds: ['research'],
            id: 'agt_research',
            isAdmin: false,
            name: 'Research',
            primaryColor: '#2563eb',
            workspaceFolder: '/tmp/tavern-research-workspace',
        });

        const listResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents')
        );

        expect(listResponse.status).toBe(200);
        await expect(listResponse.json()).resolves.toMatchObject({
            agents: expect.arrayContaining([
                expect.objectContaining({
                    enabledSkillIds: ['research'],
                    id: 'agt_research',
                    name: 'Research',
                    workspaceFolder: '/tmp/tavern-research-workspace',
                }),
            ]),
        });
        expect(getChat('cht_agt_research_dm')).toMatchObject({
            id: 'cht_agt_research_dm',
            kind: 'dm',
            participants: [
                { id: 'agt_research', kind: 'agent', label: 'Research' },
                { id: 'usr_tavern', kind: 'user', label: 'You' },
            ],
            title: 'Research',
        });
    });

    it('seeds the workspace starter kit when creating an agent', async () => {
        const workspaceFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'tavern-create-seed-'));

        try {
            const createResponse = await handleTavernRuntimeRequest(
                new Request('http://runtime.test/agents', {
                    body: JSON.stringify({
                        archetype: 'analyst',
                        bio: 'Data analyst — decision-shaped reads',
                        id: 'agt_analyst',
                        name: 'analyst',
                        workspaceFolder,
                    }),
                    headers: { 'content-type': 'application/json' },
                    method: 'POST',
                })
            );
            expect(createResponse.status).toBe(200);

            const memory = await fs.readFile(path.join(workspaceFolder, 'MEMORY.md'), 'utf8');
            expect(memory).toMatch(/^# analyst\n/u);
            expect(memory).toContain('Data analyst — decision-shaped reads');
            expect(memory).toContain('notes/lane.md — ');
            await expect(
                fs.readFile(path.join(workspaceFolder, 'notes', 'lane.md'), 'utf8')
            ).resolves.toContain('# Your lane: data reads for decisions');
            await expect(
                fs.readFile(
                    path.join(workspaceFolder, 'notes', 'practices', 'task-claim-lock.md'),
                    'utf8'
                )
            ).resolves.toContain('the claim is the concurrency lock');
        } finally {
            await fs.rm(workspaceFolder, { force: true, recursive: true });
        }
    });

    it('does not restore revoked default host tools on agent updates', () => {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: [],
                id: 'agt_tools',
                isAdmin: false,
                name: 'Tools',
                primaryColor: null,
                workspaceFolder: '/tmp/tavern-tools-workspace',
            },
        });
        expect(hasAgentHostToolGrant('agt_tools', 'web_fetch')).toBe(true);

        setAgentHostToolGrant('agt_tools', 'web_fetch', false);
        updateStoredAgent({ agentId: 'agt_tools', name: 'UpdatedTools' });

        expect(hasAgentHostToolGrant('agt_tools', 'web_fetch')).toBe(false);
    });

    it('does not restore a disabled skill from legacy agent JSON', () => {
        upsertStoredAgent({
            agent: {
                enabledSkillIds: ['research'],
                id: 'agt_skills',
                isAdmin: false,
                name: 'Skills',
                primaryColor: null,
                workspaceFolder: '/tmp/tavern-skills-workspace',
            },
        });

        setRuntimeSkillEnabled('research', false);

        expect(getStoredAgent('agt_skills')?.enabledSkillIds).toEqual([]);
    });

    it('persists the agent bio through create, update, and clear', async () => {
        const createResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents', {
                body: JSON.stringify({
                    bio: 'Runs the Amazon Merch business.',
                    id: 'agt_merch',
                    name: 'Merch',
                    workspaceFolder: '/tmp/tavern-merch-workspace',
                }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            })
        );

        expect(createResponse.status).toBe(200);
        await expect(createResponse.json()).resolves.toMatchObject({
            bio: 'Runs the Amazon Merch business.',
            id: 'agt_merch',
        });

        const bioResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents/agt_merch/bio', {
                body: JSON.stringify({ bio: 'Owns Merch sales and listings.' }),
                headers: { 'content-type': 'application/json' },
                method: 'PATCH',
            })
        );
        expect(bioResponse.status).toBe(200);

        const nameResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents/agt_merch/name', {
                body: JSON.stringify({ name: 'Merchant' }),
                headers: { 'content-type': 'application/json' },
                method: 'PATCH',
            })
        );
        expect(nameResponse.status).toBe(200);

        const configResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents/agt_merch/config')
        );
        await expect(configResponse.json()).resolves.toMatchObject({
            bio: 'Owns Merch sales and listings.',
            id: 'agt_merch',
            name: 'Merchant',
        });

        const clearResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents/agt_merch/bio', {
                body: JSON.stringify({ bio: null }),
                headers: { 'content-type': 'application/json' },
                method: 'PATCH',
            })
        );
        expect(clearResponse.status).toBe(200);

        const clearedConfig = (await (
            await handleTavernRuntimeRequest(
                new Request('http://runtime.test/agents/agt_merch/config')
            )
        ).json()) as { bio?: string | null };
        expect(clearedConfig.bio ?? null).toBeNull();
    });

    it('sets and clears the agent thinking default', async () => {
        await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents', {
                body: JSON.stringify({
                    id: 'agt_thinker',
                    name: 'Thinker',
                    workspaceFolder: '/tmp/tavern-thinker-workspace',
                }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            })
        );

        const setResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents/agt_thinker/thinking-default', {
                body: JSON.stringify({ thinkingDefault: 'max' }),
                headers: { 'content-type': 'application/json' },
                method: 'PATCH',
            })
        );
        expect(setResponse.status).toBe(200);
        const setConfig = (await (
            await handleTavernRuntimeRequest(
                new Request('http://runtime.test/agents/agt_thinker/config')
            )
        ).json()) as { thinkingDefault?: string | null };
        expect(setConfig.thinkingDefault).toBe('max');

        // null clears the override; the ?? merge used to resurrect it.
        const clearResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents/agt_thinker/thinking-default', {
                body: JSON.stringify({ thinkingDefault: null }),
                headers: { 'content-type': 'application/json' },
                method: 'PATCH',
            })
        );
        expect(clearResponse.status).toBe(200);
        const clearedConfig = (await (
            await handleTavernRuntimeRequest(
                new Request('http://runtime.test/agents/agt_thinker/config')
            )
        ).json()) as { thinkingDefault?: string | null };
        expect(clearedConfig.thinkingDefault ?? null).toBeNull();
    });

    it('archives an agent built-in DM when the agent is deleted', async () => {
        await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents', {
                body: JSON.stringify({
                    id: 'agt_research',
                    name: 'Research',
                    workspaceFolder: '/tmp/tavern-research-workspace',
                }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            })
        );

        const deleteResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents/agt_research', {
                method: 'DELETE',
            })
        );

        expect(deleteResponse.status).toBe(200);
        expect(getChat('cht_agt_research_dm')).toMatchObject({
            id: 'cht_agt_research_dm',
            metadata: {
                tavern: expect.objectContaining({
                    archived: true,
                    displayName: 'Research',
                }),
            },
        });
    });

    it('applies model and skill updates to the addressed agent', async () => {
        await enableClaudeModels();
        await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents', {
                body: JSON.stringify({
                    id: 'agt_research',
                    name: 'Research',
                    workspaceFolder: '/tmp/tavern-research-workspace',
                }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            })
        );

        const modelResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents/agt_research/model', {
                body: JSON.stringify({
                    model: { model: 'claude-sonnet-4-6', provider: 'claude' },
                }),
                headers: { 'content-type': 'application/json' },
                method: 'PATCH',
            })
        );
        const skillsResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents', {
                body: JSON.stringify({
                    enabledSkillIds: ['research', 'charts'],
                    id: 'agt_research',
                    name: 'Research',
                    workspaceFolder: '/tmp/tavern-research-workspace',
                }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            })
        );

        expect(modelResponse.status).toBe(200);
        expect(skillsResponse.status).toBe(200);

        const configResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents/agt_research/config')
        );
        const config = (await configResponse.json()) as { enabledSkillIds: string[] };
        expect(config).toMatchObject({
            id: 'agt_research',
            modelName: { model: 'claude-sonnet-4-6', provider: 'claude' },
        });
        expect(config.enabledSkillIds).toEqual(expect.arrayContaining(['research', 'charts']));
    });

    it('marks installed skills ineligible when they are not assigned to the target agent', async () => {
        await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents', {
                body: JSON.stringify({
                    enabledSkillIds: [],
                    id: 'agt_unskilled',
                    name: 'Unskilled',
                    workspaceFolder: '/tmp/tavern-unskilled-workspace',
                }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            })
        );

        await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents', {
                body: JSON.stringify({
                    id: 'agt_skilled',
                    name: 'Skilled',
                    workspaceFolder: '/tmp/tavern-skilled-workspace',
                }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            })
        );
        const primaryResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/skills?agentId=agt_skilled')
        );
        const unskilledResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/skills?agentId=agt_unskilled')
        );
        const unknownResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/skills?agentId=agt_missing')
        );

        expect(primaryResponse.status).toBe(200);
        expect(unskilledResponse.status).toBe(200);
        expect(unknownResponse.status).toBe(200);

        const primary = (await primaryResponse.json()) as {
            skills: Array<{ eligible: boolean; id: string }>;
        };
        const unskilled = (await unskilledResponse.json()) as {
            skills: Array<{ eligible: boolean; id: string }>;
        };
        const unknown = (await unknownResponse.json()) as { skills: Array<{ id: string }> };

        expect(primary.skills).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ eligible: true, id: 'tavern-agent' }),
            ])
        );
        expect(unskilled.skills).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ eligible: false, id: 'tavern-agent' }),
            ])
        );
        expect(unknown.skills).toEqual([]);
    });

    it('serves agent engine sessions and evidence through the runtime adapter', async () => {
        const sessionKey = 'session_1';

        const listResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agent/sessions')
        );
        const messagesResponse = await handleTavernRuntimeRequest(
            new Request(`http://runtime.test/agent/sessions/${sessionKey}/messages`)
        );
        const graphResponse = await handleTavernRuntimeRequest(
            new Request(`http://runtime.test/agent/sessions/${sessionKey}/graph`)
        );
        const resyncResponse = await handleTavernRuntimeRequest(
            new Request(`http://runtime.test/agent/sessions/${sessionKey}/resync`, {
                method: 'POST',
            })
        );

        expect(listResponse.status).toBe(200);
        await expect(listResponse.json()).resolves.toEqual({ sessions: [] });
        expect(messagesResponse.status).toBe(404);
        expect(graphResponse.status).toBe(404);
        expect(resyncResponse.status).toBe(404);
    });

    it('keeps disconnected catalog providers out of executable model reads', async () => {
        const previousCodexCommand = process.env.TAVERN_AGENT_CODEX_CLI_COMMAND;
        const previousClaudeCommand = process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND;
        process.env.TAVERN_AGENT_CODEX_CLI_COMMAND = 'tavern-missing-codex';
        process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = 'tavern-missing-claude';
        // This scenario needs Claude disconnected despite the suite seed.
        clearClaudeCredentials();

        const modelsResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/models')
        );
        const catalogResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/model-providers/catalog')
        );

        try {
            expect(modelsResponse.status).toBe(200);
            await expect(modelsResponse.json()).resolves.toMatchObject({
                models: [],
                providers: [],
            });
            expect(catalogResponse.status).toBe(200);
            await expect(catalogResponse.json()).resolves.toMatchObject({
                providers: expect.arrayContaining([
                    expect.objectContaining({ accessState: 'unavailable', id: 'codex' }),
                    // Claude access is credential-driven: disconnected reads
                    // needs-auth regardless of CLI presence.
                    expect.objectContaining({ accessState: 'needs-auth', id: 'claude' }),
                ]),
            });
        } finally {
            restoreEnv('TAVERN_AGENT_CODEX_CLI_COMMAND', previousCodexCommand);
            restoreEnv('TAVERN_AGENT_CLAUDE_CODE_COMMAND', previousClaudeCommand);
        }
    });

    it('applies agent model updates through the dashboard model API', async () => {
        await enableClaudeModels();
        await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents', {
                body: JSON.stringify({
                    id: 'agt_modeler',
                    name: 'Modeler',
                    workspaceFolder: '/tmp/tavern-modeler-workspace',
                }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            })
        );
        const response = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents/agt_modeler/model', {
                body: JSON.stringify({
                    model: { model: 'claude-sonnet-4-6', provider: 'claude' },
                }),
                headers: { 'content-type': 'application/json' },
                method: 'PATCH',
            })
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            config: {
                agents: {
                    list: [
                        {
                            id: 'agt_modeler',
                            model: {
                                model: 'claude-sonnet-4-6',
                                provider: 'claude',
                            },
                        },
                    ],
                },
            },
            valid: true,
        });

        const listResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/agents')
        );
        await expect(listResponse.json()).resolves.toMatchObject({
            agents: [
                expect.objectContaining({
                    modelName: {
                        model: 'claude-sonnet-4-6',
                        provider: 'claude',
                    },
                }),
            ],
        });
    });

    it('serves agent engine skill list reads through the runtime adapter', async () => {
        const listResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/skills')
        );
        const detailResponse = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/skills/tavern-agent')
        );

        expect(listResponse.status).toBe(200);
        await expect(listResponse.json()).resolves.toMatchObject({
            skills: expect.arrayContaining([expect.objectContaining({ id: 'tavern-agent' })]),
        });
        expect(detailResponse.status).toBe(200);
        await expect(detailResponse.json()).resolves.toMatchObject({
            contentMarkdown: expect.stringContaining('# Grotto Agent'),
            id: 'tavern-agent',
        });
    });

    it('serves built-in runtime tools through the runtime adapter', async () => {
        const response = await handleTavernRuntimeRequest(new Request('http://runtime.test/tools'));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            tools: expect.arrayContaining([
                expect.objectContaining({
                    configured: true,
                    description: 'Run shell commands inside the agent workspace.',
                    enabled: true,
                    id: 'bash',
                    label: 'Bash',
                    name: 'bash',
                    readOnly: true,
                    tools: ['bash'],
                }),
                expect.objectContaining({
                    configured: true,
                    description: 'Read UTF-8 files from the agent workspace.',
                    enabled: true,
                    id: 'read_file',
                    label: 'Read file',
                    name: 'read_file',
                    readOnly: true,
                    tools: ['read_file'],
                }),
                expect.objectContaining({
                    configured: true,
                    description:
                        'Read current Grotto chat messages by sequence, search text, or message id.',
                    enabled: true,
                    id: 'chat_messages',
                    label: 'Chat messages',
                    name: 'chat_messages',
                    readOnly: true,
                    tools: ['chat_messages_list', 'chat_messages_search', 'chat_message_get'],
                }),
            ]),
        });
    });

    it('keeps built-in runtime tools enabled when update requests arrive', async () => {
        const response = await handleTavernRuntimeRequest(
            new Request('http://runtime.test/tools/bash/enabled', {
                body: JSON.stringify({ enabled: false }),
                headers: { 'content-type': 'application/json' },
                method: 'PUT',
            })
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            enabled: true,
            id: 'bash',
            readOnly: true,
        });
    });
});

async function enableClaudeModels() {
    process.env.TAVERN_AGENT_CLAUDE_CODE_COMMAND = process.execPath;
    await setModelProviderEnabled({ enabled: true, providerId: 'claude' });
}

function handleAgentEngineFetch(input: string | URL | Request) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);

    if (url.pathname === '/api/sessions') {
        return jsonResponse({
            data: [
                {
                    id: 'session_1',
                    last_active: 1_779_828_060,
                    message_count: 1,
                    preview: 'Ready.',
                    source: 'api_server',
                    started_at: 1_779_828_000,
                    title: 'Chat 1',
                },
            ],
            object: 'list',
        });
    }

    if (url.pathname === '/api/sessions/session_1/messages') {
        return jsonResponse({
            data: [
                {
                    content: 'Ready.',
                    role: 'assistant',
                    timestamp: 1_779_828_060,
                },
            ],
            object: 'list',
            session_id: 'session_1',
        });
    }

    if (url.pathname === '/api/model/options') {
        return jsonResponse({
            providers: [
                {
                    models: ['gpt-5.5'],
                    name: 'OpenAI Codex',
                    slug: 'openai-codex',
                },
            ],
        });
    }

    if (url.pathname === '/api/model/set') {
        return jsonResponse({ ok: true, model: 'gpt-5.5', provider: 'openai-codex' });
    }

    if (url.pathname === '/api/skills') {
        return jsonResponse({
            skills: [
                {
                    description: 'Browser skill',
                    enabled: true,
                    id: 'browser',
                    name: 'Browser',
                },
            ],
        });
    }

    return jsonResponse({ error: 'not found' }, { status: 404 });
}

function jsonResponse(body: unknown, init?: ResponseInit) {
    return Promise.resolve(
        new Response(JSON.stringify(body), {
            headers: { 'content-type': 'application/json' },
            status: init?.status ?? 200,
        })
    );
}

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
        return;
    }
    process.env[key] = value;
}
