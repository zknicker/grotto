import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentRetireCommand } from '@grotto/api';

export function parseAgentRetireCommand(frame: unknown): AgentRetireCommand | null {
    if (
        !isRecord(frame) ||
        frame.type !== 'agent-retire' ||
        typeof frame.agentId !== 'string' ||
        !/^agt_[A-Za-z0-9_-]{16}$/u.test(frame.agentId)
    ) {
        return null;
    }
    return { agentId: frame.agentId, type: 'agent-retire' };
}

/** Idempotently erases exactly one retired Agent's Computer-local partition. */
export async function purgeRetiredAgent(input: {
    agentId: string;
    dataRoot: string;
    serverId: string;
}): Promise<void> {
    if (!/^agt_[A-Za-z0-9_-]{16}$/u.test(input.agentId)) {
        throw new Error('Invalid Agent id.');
    }
    if (!/^srv_[A-Za-z0-9_-]{16}$/u.test(input.serverId)) {
        throw new Error('Invalid Server id.');
    }
    await rm(join(input.dataRoot, 'servers', input.serverId, 'agents', input.agentId), {
        force: true,
        recursive: true,
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
