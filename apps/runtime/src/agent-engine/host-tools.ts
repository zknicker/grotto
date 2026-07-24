import type { ToolSet } from '@ai-sdk/provider-utils';
import type { AgentRuntimeHostToolId } from '@tavern/api';
import { tool } from 'ai';
import * as z from 'zod';
import { SystemAgentBrowserRunner } from '../browser/agent-browser-cli.ts';
import { getBrowserService } from '../browser/service.ts';
import { getDb } from '../db/connection.ts';
import type { Database } from '../db/sqlite.ts';
import { namedParams } from '../db/sqlite.ts';

const hostToolDefinitions = {
    browser: {
        description: 'Control the managed browser with agent-browser commands.',
        name: 'Browser',
    },
    web_fetch: {
        description: 'Fetch a web page as readable markdown.',
        name: 'Web fetch',
    },
} as const;

export function ensureDefaultHostToolGrants(agentId: string, db: Database = getDb()) {
    const now = new Date().toISOString();
    db.prepare(
        `INSERT OR IGNORE INTO agent_host_tool_grants
         (agent_id, tool_id, created_at, updated_at)
         VALUES ($agentId, 'web_fetch', $now, $now)`
    ).run(namedParams({ agentId, now }));
}

export function hasAgentHostToolGrant(
    agentId: string,
    toolId: AgentRuntimeHostToolId,
    db: Database = getDb()
) {
    return Boolean(
        db
            .prepare(
                `SELECT 1 FROM agent_host_tool_grants
                 WHERE agent_id = $agentId AND tool_id = $toolId`
            )
            .get(namedParams({ agentId, toolId }))
    );
}

export function listAgentHostTools(agentId: string, db: Database = getDb()) {
    return (Object.keys(hostToolDefinitions) as AgentRuntimeHostToolId[]).map((id) => ({
        available: id === 'web_fetch' || Boolean(getBrowserService()),
        ...hostToolDefinitions[id],
        granted: hasAgentHostToolGrant(agentId, id, db),
        id,
    }));
}

export function setAgentHostToolGrant(
    agentId: string,
    toolId: AgentRuntimeHostToolId,
    enabled: boolean,
    db: Database = getDb()
) {
    if (!enabled) {
        db.prepare(
            'DELETE FROM agent_host_tool_grants WHERE agent_id = $agentId AND tool_id = $toolId'
        ).run(namedParams({ agentId, toolId }));
        return;
    }
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO agent_host_tool_grants (agent_id, tool_id, created_at, updated_at)
         VALUES ($agentId, $toolId, $now, $now)
         ON CONFLICT(agent_id, tool_id) DO UPDATE SET updated_at = excluded.updated_at`
    ).run(namedParams({ agentId, now, toolId }));
}

export function listAgentsWithHostToolGrant(
    toolId: AgentRuntimeHostToolId,
    db: Database = getDb()
) {
    return db
        .prepare(
            `SELECT agents.id, agents.name
             FROM agent_host_tool_grants
             JOIN agents ON agents.id = agent_host_tool_grants.agent_id
             WHERE tool_id = $toolId
             ORDER BY agents.name, agents.id`
        )
        .all(namedParams({ toolId })) as Array<{ id: string; name: string }>;
}

export function clearHostToolGrants(toolId: AgentRuntimeHostToolId, db: Database = getDb()) {
    db.prepare('DELETE FROM agent_host_tool_grants WHERE tool_id = $toolId').run(
        namedParams({ toolId })
    );
}

export function createBrowserToolForAgent(agentId: string): ToolSet {
    if (!hasAgentHostToolGrant(agentId, 'browser')) {
        return {};
    }
    return {
        browser: tool({
            description:
                'Control the managed browser. Pass one agent-browser command as an argument array.',
            inputSchema: z.object({
                args: z.array(z.string()).min(1).max(100),
            }),
            execute: async ({ args }) => {
                if (!hasAgentHostToolGrant(agentId, 'browser')) {
                    throw new Error('Browser access was revoked.');
                }
                const service = getBrowserService();
                if (!service) {
                    throw new Error('Browser is unavailable. Enable it in Settings → Browser.');
                }
                return await service.commandQueue.run(async () => {
                    const attachment = await service.lifecycle.attachment();
                    const result = await new SystemAgentBrowserRunner().run(attachment.port, args);
                    if (!result.ok) {
                        throw new Error(result.stderr || 'Browser command failed.');
                    }
                    return result.stdout;
                });
            },
        }),
    };
}
