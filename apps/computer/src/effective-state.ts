import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { type AgentReasoningEffort, type GrottoAgentStatus, grottoAgentVersion } from '@grotto/api';
import { readAppliedAgentConfiguration } from './agent-configuration.ts';
import { readAgentSessionState } from './harness/session-store.ts';

export interface EffectiveAgentState {
    agentId: string;
    grottoAgentAppliedAt: string | null;
    grottoAgentStatus: GrottoAgentStatus;
    grottoAgentVersion: string | null;
    missingResources: string[];
    modelId: string | null;
    reasoningEffort: AgentReasoningEffort | null;
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
                const [configuration, session] = await Promise.all([
                    readAppliedAgentConfiguration(agentRoot),
                    readAgentSessionState(agentRoot),
                ]);
                const versionState = effectiveGrottoAgentState(session);
                if (configuration) {
                    return {
                        agentId: entry.name,
                        ...versionState,
                        missingResources: configuration.missingResources,
                        modelId: configuration.modelId,
                        reasoningEffort: configuration.reasoningEffort,
                        runtimeId: configuration.runtimeId,
                    };
                }
                return session
                    ? {
                          agentId: entry.name,
                          ...versionState,
                          missingResources: [],
                          modelId: session.effectiveModel.modelId,
                          reasoningEffort: null,
                          runtimeId: session.effectiveModel.runtimeId,
                      }
                    : {
                          agentId: entry.name,
                          ...versionState,
                          missingResources: ['session'],
                          modelId: null,
                          reasoningEffort: null,
                          runtimeId: null,
                      };
            })
    );
}

function effectiveGrottoAgentState(session: Awaited<ReturnType<typeof readAgentSessionState>>) {
    const appliedVersion = session?.grottoAgentVersion ?? null;
    const status: GrottoAgentStatus =
        appliedVersion === grottoAgentVersion
            ? 'current'
            : session?.grottoAgentStatus === 'failed'
              ? 'failed'
              : 'pending';
    return {
        grottoAgentAppliedAt: session?.grottoAgentAppliedAt ?? null,
        grottoAgentStatus: status,
        grottoAgentVersion: appliedVersion,
    };
}

function isNodeCode(error: unknown, code: string) {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === code
    );
}
