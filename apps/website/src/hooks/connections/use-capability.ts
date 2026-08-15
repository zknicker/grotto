import * as React from 'react';
import type { AgentRuntimeConnectionOutput } from '../../lib/trpc.tsx';
import type { RouteTab } from '../shell/use-route-tab.ts';
import { getRuntimeVersionMismatchReason } from './runtime-version-gate.ts';
import { useRuntimeConnection } from './use-runtime-connection.ts';

type RuntimeConnection = NonNullable<AgentRuntimeConnectionOutput>;
type RuntimeCapabilityStatus = RuntimeConnection['runtimeCapabilities'][number];

export type RuntimeCapabilityId = RuntimeCapabilityStatus['capability'];
export type CapabilityRequirement = RuntimeCapabilityId | readonly RuntimeCapabilityId[];

export interface CapabilityView {
    healthy: boolean;
    missingCapabilities: RuntimeCapabilityId[];
    reason: string | null;
    state: RuntimeCapabilityStatus['state'];
    status: RuntimeCapabilityStatus | null;
}

export const runtimeUnhealthyTooltip =
    'Runtime is not healthy. See Settings -> Grotto Runtime for more information.';
const runtimeDisconnectedReason = 'Grotto Runtime is disconnected.';
const capabilityLabels = {
    apiServer: 'Agent engine API',
    autoDispatch: 'Auto-dispatch',
    claudeAuth: 'Claude sign-in',
    codexOAuth: 'Codex OAuth',
    cron: 'Reminders',
    dashboardServer: 'Agent engine',
    gateway: 'Agent connection',
    identity: 'Identity',
    imageGeneration: 'Image generation',
    memory: 'Memory',
    memoryDreaming: 'Memory dreaming',
    memoryExtraction: 'Memory extraction',
    modelExecution: 'Model execution',
    browser: 'Browser',
    skills: 'Skills',
    webAccess: 'Web access',
} satisfies Record<RuntimeCapabilityId, string>;

export const settingsCapabilityRequirements = {
    'agent-runtime': [],
    appearance: [],
    profile: [],
    channels: ['apiServer'],
    browser: ['apiServer'],
    connections: ['apiServer'],
    jobs: [],
    models: ['apiServer'],
    sessions: ['apiServer'],
    skills: ['apiServer', 'skills'],
    updates: [],
} as const satisfies Record<string, readonly RuntimeCapabilityId[]>;

export const agentCapabilityRequirements = [
    'apiServer',
    'dashboardServer',
    'gateway',
    'modelExecution',
    'skills',
] as const satisfies readonly RuntimeCapabilityId[];

export const routeTabCapabilityRequirements = {
    activity: [],
    chat: [],
    members: [],
    search: [],
    // Tasks is a static honest-empty page (specs/tasks.md) until the
    // chat-first tasks workstream lands; it never gates on the runtime.
    tasks: [],
} as const satisfies Record<RouteTab, readonly RuntimeCapabilityId[]>;

export const newChatCapabilityRequirements = ['apiServer', 'gateway'] as const;

export function getCapability(
    connection: AgentRuntimeConnectionOutput,
    requirement: CapabilityRequirement
): CapabilityView {
    const capabilities = toCapabilityList(requirement);

    if (capabilities.length === 0) {
        return {
            healthy: true,
            missingCapabilities: [],
            reason: null,
            state: 'healthy',
            status: null,
        };
    }

    if (connection?.versionStatus === 'mismatched') {
        return {
            healthy: false,
            missingCapabilities: [],
            reason: getVersionMismatchReason(connection),
            state: 'unknown',
            status: null,
        };
    }

    const views = capabilities.map((capability) => getSingleCapability(connection, capability));
    const firstUnavailable = views.find((view) => !view.healthy) ?? null;

    return {
        healthy: firstUnavailable === null,
        missingCapabilities: views
            .filter((view) => !view.healthy)
            .map((view) => view.status?.capability ?? view.capability),
        reason: firstUnavailable?.reason ?? (firstUnavailable ? runtimeDisconnectedReason : null),
        state: firstUnavailable?.state ?? 'healthy',
        status: capabilities.length === 1 ? (views[0]?.status ?? null) : null,
    };
}

export function formatCapabilityDisabledReason(capability: CapabilityView): string {
    if (capability.missingCapabilities.length === 0) {
        return capability.reason ?? runtimeDisconnectedReason;
    }

    return `Grotto Runtime degraded: missing ${formatCapabilityList(capability.missingCapabilities)}.`;
}

export function useCapability(): (requirement: CapabilityRequirement) => CapabilityView;
export function useCapability(requirement: CapabilityRequirement): CapabilityView;
export function useCapability(requirement?: CapabilityRequirement) {
    const runtimeConnection = useRuntimeConnection();
    const resolveCapability = React.useCallback(
        (nextRequirement: CapabilityRequirement) =>
            getCapability(runtimeConnection.connection, nextRequirement),
        [runtimeConnection.connection]
    );

    return React.useMemo(
        () => (requirement === undefined ? resolveCapability : resolveCapability(requirement)),
        [requirement, resolveCapability]
    );
}

function getSingleCapability(
    connection: AgentRuntimeConnectionOutput,
    capability: RuntimeCapabilityId
): CapabilityView & { capability: RuntimeCapabilityId } {
    const status =
        connection?.runtimeCapabilities.find((record) => record.capability === capability) ?? null;

    return {
        capability,
        healthy: status?.state === 'healthy',
        missingCapabilities: status?.state === 'healthy' ? [] : [capability],
        reason: status?.reason ?? null,
        state: status?.state ?? 'unknown',
        status,
    };
}

function toCapabilityList(requirement: CapabilityRequirement): readonly RuntimeCapabilityId[] {
    return typeof requirement === 'string' ? [requirement] : requirement;
}

function formatCapabilityList(capabilities: readonly RuntimeCapabilityId[]) {
    const labels = capabilities.map((capability) => capabilityLabels[capability]);

    if (labels.length === 1) {
        return labels[0];
    }

    if (labels.length === 2) {
        return `${labels[0]} and ${labels[1]}`;
    }

    return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
}

function getVersionMismatchReason(connection: RuntimeConnection) {
    return getRuntimeVersionMismatchReason(connection);
}
