import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readAppliedAgentConfiguration } from './agent-configuration.ts';
import { readAgentSessionState } from './harness/session-store.ts';

export interface EffectiveAgentState {
    agentId: string;
    missingResources: string[];
    modelId: string | null;
    runtimeId: string | null;
}

/** Reconstructs the Computer-owned applied state from each durable Agent session. */
export async function readEffectiveAgentStates(
    dataRoot: string,
    serverId: string
): Promise<EffectiveAgentState[]> {
    const agentsRoot = join(dataRoot, 'servers', serverId, 'agents');
    let entries: Dirent[];
    try {
        entries = await readdir(agentsRoot, { withFileTypes: true });
    } catch (error) {
        if (isNodeCode(error, 'ENOENT')) {
            return [];
        }
        throw error;
    }
    return await Promise.all(
        entries
            .filter((entry) => entry.isDirectory())
            .sort((left, right) => left.name.localeCompare(right.name))
            .map(async (entry): Promise<EffectiveAgentState> => {
                const agentRoot = join(agentsRoot, entry.name);
                const configuration = await readAppliedAgentConfiguration(agentRoot);
                if (configuration) {
                    return { agentId: entry.name, ...configuration };
                }
                const session = await readAgentSessionState(agentRoot);
                return session
                    ? {
                          agentId: entry.name,
                          missingResources: [],
                          modelId: session.effectiveModel.modelId,
                          runtimeId: session.effectiveModel.runtimeId,
                      }
                    : {
                          agentId: entry.name,
                          missingResources: ['session'],
                          modelId: null,
                          runtimeId: null,
                      };
            })
    );
}

function isNodeCode(error: unknown, code: string) {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === code
    );
}
