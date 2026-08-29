import { grottoReleaseDiscoverySchema } from '@grotto/api';
import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { useDesktopUpdate } from '../../hooks/desktop/use-desktop-update.ts';
import { useAgents } from '../../hooks/members/use-agents.ts';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import { isElectronDesktopApp } from '../../lib/desktop-bridge.ts';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import type { ComputerUpdateComputer } from '../computers/computer-update-card.tsx';
import { computerLabel } from '../computers/presentation.ts';
import type {
    GrottoUpdateComputer,
    GrottoUpdateDesktop,
    GrottoUpdateView,
} from './grotto-update-model.ts';
import { projectGrottoUpdate } from './grotto-update-model.ts';
import {
    createGrottoUpdateController,
    type GrottoUpdateRunResult,
} from './grotto-update-reconciler.ts';
import { useOfflineComputers } from './use-offline-computers.ts';

const productionReleaseUrl = '/api/grotto-release';
const fallbackDiscovery = {
    latest: import.meta.env.VITE_GROTTO_RELEASE_SNAPSHOT,
    running: { agent: null, server: null },
};
const GrottoUpdateContext = React.createContext<ReturnType<typeof useGrottoUpdateState> | null>(
    null
);

export function GrottoUpdateProvider({
    canOperate,
    children,
    serverId,
}: {
    canOperate: boolean;
    children: React.ReactNode;
    serverId: string;
}) {
    const value = useGrottoUpdateState(serverId, canOperate);
    return React.createElement(GrottoUpdateContext.Provider, { value }, children);
}

export function useGrottoUpdate() {
    const update = React.useContext(GrottoUpdateContext);
    if (!update) {
        throw new Error('useGrottoUpdate must be used inside GrottoUpdateProvider');
    }
    return update;
}

function useGrottoUpdateState(serverId: string, canOperate: boolean) {
    const agents = useAgents(serverId);
    const computers = useComputers(serverId, { enabled: canOperate });
    const offlineComputers = useOfflineComputers(computers.data ?? []);
    const desktop = useDesktopUpdate();
    const updateComputer = grottoTrpc.computer.update.useMutation();
    const release = useQuery({
        initialData: fallbackDiscovery,
        queryFn: fetchLatestRelease,
        queryKey: ['grotto-release', 'latest'],
        refetchInterval: 10 * 60 * 1000,
        retry: 1,
        staleTime: 60 * 1000,
    });
    const [runResult, setRunResult] = React.useState<GrottoUpdateRunResult | null>(null);
    const [isRunning, setIsRunning] = React.useState(false);
    const activeRun = React.useRef<Promise<GrottoUpdateRunResult> | null>(null);
    const observations = React.useRef({ agents: agents.data, computers: computers.data, desktop });
    observations.current = { agents: agents.data, computers: computers.data, desktop };

    const observedView = projectObservedUpdate({
        agents: agents.data ?? [],
        computers: computers.data ?? [],
        desktop,
        discovery: release.data,
    });
    const view = applyRunFailures(observedView, runResult);

    const run = React.useCallback(() => {
        if (activeRun.current) {
            return activeRun.current;
        }
        setRunResult(null);
        setIsRunning(true);
        const selectedDiscovery = release.data;
        const readView = () =>
            projectObservedUpdate({
                agents: observations.current.agents ?? [],
                computers: observations.current.computers ?? [],
                desktop: observations.current.desktop,
                discovery: selectedDiscovery,
            });
        const controller = createGrottoUpdateController({
            downloadDesktop: async () => observations.current.desktop.updateAndRestart(),
            readView,
            restartDesktop: async () => observations.current.desktop.updateAndRestart(),
            updateComputer: async ({ computerId, targetVersion }) => {
                await updateComputer.mutateAsync({ computerId, serverId, targetVersion });
            },
            waitForChange: async (step) => {
                const initial = stepSignature(step);
                const maximumAttempts =
                    step.kind === 'computer' && step.phase === 'waiting-for-agents'
                        ? Number.POSITIVE_INFINITY
                        : 120;
                for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
                    await wait(1000);
                    if (step.kind === 'computer') {
                        const [computerResult, agentResult] = await Promise.all([
                            computers.refetch(),
                            agents.refetch(),
                        ]);
                        observations.current.computers = computerResult.data;
                        observations.current.agents = agentResult.data;
                    }
                    const next = readView().steps.find((candidate) => candidate.id === step.id);
                    if (!next || stepSignature(next) !== initial) {
                        return;
                    }
                }
                throw new Error(`${step.label} did not finish updating.`);
            },
        });
        const task = controller
            .run()
            .then((result) => {
                setRunResult(result);
                return result;
            })
            .catch((error: unknown) => {
                const result = {
                    failures: [
                        {
                            detail:
                                error instanceof Error ? error.message : 'Grotto could not update.',
                            stepId: 'update-sequence',
                        },
                    ],
                    kind: 'failed',
                } as const;
                setRunResult(result);
                return result;
            })
            .finally(async () => {
                activeRun.current = null;
                setIsRunning(false);
                await Promise.all([agents.refetch(), computers.refetch()]);
            });
        activeRun.current = task;
        return task;
    }, [agents, computers, release.data, serverId, updateComputer]);

    return {
        canOperate,
        isRunning,
        offlineComputers,
        releaseError: release.error,
        run,
        runResult,
        view,
    };
}

function projectObservedUpdate(input: {
    agents: readonly import('@grotto/api').Agent[];
    computers: readonly ComputerUpdateComputer[];
    desktop: ReturnType<typeof useDesktopUpdate>;
    discovery: import('@grotto/api').GrottoReleaseDiscovery;
}): GrottoUpdateView {
    const observedComputers = input.computers.filter(
        (computer) => computer.health !== 'offline' || computer.updatePhase === 'restarting'
    );
    const observedComputerIds = new Set(observedComputers.map((computer) => computer.id));
    return projectGrottoUpdate({
        computers: input.computers.map(projectComputer),
        desktop: projectDesktop(input.desktop),
        release: input.discovery.latest,
        runningAgentVersion: commonAppliedAgentVersion(
            input.agents.filter((agent) => observedComputerIds.has(agent.computerId))
        ),
    });
}

function commonAppliedAgentVersion(agents: readonly import('@grotto/api').Agent[]) {
    const versions = new Set(agents.map((agent) => agent.grottoAgent.appliedVersion));
    if (versions.size === 0) {
        return null;
    }
    return versions.size === 1 ? (agents[0]?.grottoAgent.appliedVersion ?? null) : 'Mixed';
}

function projectComputer(computer: ComputerUpdateComputer): GrottoUpdateComputer {
    return {
        currentVersion: computer.productVersion,
        detail: computer.updateDetail,
        failedPhase: computer.updateFailedPhase,
        health: computer.health,
        id: computer.id,
        lastConnectedAt: computer.lastConnectedAt,
        name: computerLabel(computer),
        phase: computer.updatePhase,
        progress:
            computer.updateDownloadedBytes !== null &&
            computer.updateTotalBytes !== null &&
            computer.updateTotalBytes > 0
                ? computer.updateDownloadedBytes / computer.updateTotalBytes
                : null,
        reportedTargetVersion: computer.updateTargetVersion,
        updateUpdatedAt: computer.updateUpdatedAt,
    };
}

function applyRunFailures(
    view: GrottoUpdateView,
    result: GrottoUpdateRunResult | null
): GrottoUpdateView {
    if (result?.kind !== 'failed') {
        return view;
    }
    const failures = new Map(
        result.failures.flatMap((failure) => {
            if (failure.stepId === 'update-sequence') {
                return [[failure.stepId, failure.detail] as const];
            }
            const fact = view.componentFacts.find((candidate) => candidate.id === failure.stepId);
            return fact && fact.status !== 'current'
                ? [[failure.stepId, failure.detail] as const]
                : [];
        })
    );
    if (failures.size === 0) {
        return view;
    }
    const firstFailure = failures.values().next().value ?? 'Grotto could not update.';
    return {
        ...view,
        componentFacts: view.componentFacts.map((fact) => {
            const detail = failures.get(fact.id);
            return detail
                ? {
                      ...fact,
                      detail,
                      remedy: fact.remedy ?? 'Try again. If the problem continues, open Settings.',
                      status: 'failed' as const,
                  }
                : fact;
        }),
        detail: firstFailure,
        headline: 'Update needs attention',
        phase: 'failed',
        primaryAction: { kind: 'retry', label: 'Try again' },
    };
}

function projectDesktop(desktop: ReturnType<typeof useDesktopUpdate>): GrottoUpdateDesktop {
    if (!isElectronDesktopApp()) {
        return { kind: 'web' };
    }
    return {
        currentVersion: desktop.installedVersion,
        detail: desktop.status.phase === 'error' ? desktop.status.message : null,
        kind: 'desktop',
        phase: desktop.status.phase === 'unsupported' ? 'idle' : desktop.status.phase,
        progress: desktop.status.phase === 'downloading' ? desktop.status.progress : null,
    };
}

async function fetchLatestRelease() {
    const response = await fetch(productionReleaseUrl);
    if (!response.ok) {
        throw new Error(`Grotto update check failed (${response.status}).`);
    }
    return grottoReleaseDiscoverySchema.parse(await response.json());
}

function stepSignature(step: GrottoUpdateView['steps'][number]) {
    return JSON.stringify([step.phase, step.currentVersion, step.progress, step.detail]);
}

function wait(milliseconds: number) {
    return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}
