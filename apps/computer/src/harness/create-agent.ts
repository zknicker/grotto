import { basename, dirname, join } from 'node:path';
import type { HarnessV1 } from '@ai-sdk/harness';
import { HarnessAgent, type HarnessAgentSkill } from '@ai-sdk/harness/agent';
import type { ToolSet } from '@ai-sdk/provider-utils';
import type { HarnessTurnInput } from './executor.ts';
import { createLocalTrustedSandboxProvider } from './sandbox.ts';

type AgentConstructionInput = Pick<
    HarnessTurnInput,
    'agentId' | 'env' | 'homeDir' | 'runtime' | 'runtimeId' | 'tools' | 'webAccess' | 'workspaceDir'
>;

export function createHarnessAgent(
    input: AgentConstructionInput,
    options: { harness: HarnessV1<ToolSet>; instructions: string; skills: HarnessAgentSkill[] }
): HarnessAgent {
    return new HarnessAgent({
        harness: options.harness,
        id: input.agentId,
        ...(input.runtimeId === 'claude-code'
            ? {
                  inactiveTools:
                      input.webAccess !== null ? ['WebFetch'] : ['webSearch', 'WebFetch'],
              }
            : {}),
        instructions: options.instructions,
        permissionMode: 'allow-all',
        sandbox: createLocalTrustedSandboxProvider(sandboxOptions(input)),
        // Anchor at the parent so the workDir remains visible to workspace browsing.
        sandboxConfig: { workDir: basename(input.workspaceDir) },
        skills: options.skills,
        tools: input.tools,
    });
}

export function sandboxOptions(input: AgentConstructionInput) {
    const rootDir = dirname(input.workspaceDir);
    const profile = authProfileFor(input.runtimeId);
    if (input.runtimeId === 'grok-build') {
        return {
            authProfiles: ['grok-build'] as const,
            env: {
                ...input.env,
                GROK_HOME: join(input.homeDir, '.grok'),
                HOME: input.homeDir,
            },
            homeDir: input.homeDir,
            rootDir,
            runtime: input.runtime,
        };
    }
    if (input.runtimeId !== 'codex') {
        return {
            ...(profile ? { authProfiles: [profile] as const } : {}),
            env: { ...input.env, HOME: input.homeDir },
            homeDir: input.homeDir,
            rootDir,
            runtime: input.runtime,
        };
    }
    // Isolated CODEX_HOME reuses host login without leaking cross-Agent sessions.
    return {
        authProfiles: ['codex'] as const,
        env: {
            ...input.env,
            CODEX_HOME: join(input.homeDir, '.codex'),
            HOME: input.homeDir,
        },
        homeDir: input.homeDir,
        rootDir,
        runtime: input.runtime,
    };
}

function authProfileFor(runtimeId: string) {
    if (
        runtimeId === 'claude-code' ||
        runtimeId === 'codex' ||
        runtimeId === 'grok-build' ||
        runtimeId === 'pi'
    ) {
        return runtimeId;
    }
    return null;
}
