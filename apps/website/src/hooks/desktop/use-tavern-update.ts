import * as React from 'react';
import type { AgentRuntimeConnectionOutput } from '../../lib/trpc.tsx';
import { trpc } from '../../lib/trpc.tsx';
import {
    compareVersions,
    getRuntimeVersionMismatchKind,
} from '../connections/runtime-version-gate.ts';
import { useRuntimeConnection } from '../connections/use-runtime-connection.ts';
import { type DesktopUpdateStatus, useDesktopUpdate } from './use-desktop-update.ts';

export type TavernUpdateStatus =
    | { phase: 'unsupported'; detail: string }
    | { phase: 'idle'; detail: string }
    | { phase: 'app-update-required'; detail: string }
    | { phase: 'runtime-disconnected'; detail: string }
    | { phase: 'available'; detail: string; version: string }
    | { phase: 'checking'; detail: string }
    | { phase: 'staging-runtime'; detail: string; version: string }
    | { phase: 'downloading-app'; detail: string; progress: number; version: string }
    | { phase: 'ready'; detail: string; version: string }
    | { phase: 'restarting-runtime'; detail: string; version: string }
    | { phase: 'restarting-app'; detail: string; version: string }
    | { phase: 'failed'; detail: string };

type TavernUpdatePendingAction = 'download-app' | 'none' | 'stage-runtime';

export function useTavernUpdate() {
    const utils = trpc.useUtils();
    const runtimeConnection = useRuntimeConnection();
    const desktopUpdate = useDesktopUpdate();
    const [pendingAction, setPendingAction] = React.useState<TavernUpdatePendingAction>('none');
    const versionMismatchKind =
        runtimeConnection.status === 'version-mismatch' && runtimeConnection.connection !== null
            ? getRuntimeVersionMismatchKind(runtimeConnection.connection)
            : null;
    const appNeedsUpdate = versionMismatchKind === 'app-needs-update';
    const needsRuntimeUpdate = versionMismatchKind === 'runtime-needs-update';
    const isRuntimeDisconnected =
        runtimeConnection.status === 'error' || runtimeConnection.status === 'unreachable';
    const runtimeUpdateStatus = trpc.agentRuntime.updateStatus.useQuery(undefined, {
        enabled: needsRuntimeUpdate,
        retry: false,
    });
    const startRuntimeUpdate = trpc.agentRuntime.startUpdate.useMutation({
        onSettled: async () => {
            await runtimeUpdateStatus.refetch();
        },
    });
    const restartRuntime = trpc.agentRuntime.restartUpdate.useMutation({
        onSettled: async () => {
            await runtimeUpdateStatus.refetch();
        },
    });
    const [finalRestartPhase, setFinalRestartPhase] = React.useState<'idle' | 'runtime' | 'app'>(
        'idle'
    );

    const status = getTavernUpdateStatus({
        desktopUpdateStatus: desktopUpdate.status,
        appNeedsUpdate,
        finalRestartPhase,
        isRuntimeDisconnected,
        needsRuntimeUpdate,
        pendingAction,
        runtimeConnection: runtimeConnection.connection,
        runtimeUpdateError: needsRuntimeUpdate
            ? (runtimeUpdateStatus.error?.message ??
              startRuntimeUpdate.error?.message ??
              restartRuntime.error?.message ??
              null)
            : null,
        runtimeUpdateStatus: runtimeUpdateStatus.data ?? null,
    });

    const updateAndRestart = React.useCallback(async () => {
        if (appNeedsUpdate) {
            if (desktopUpdate.status.phase === 'ready') {
                setFinalRestartPhase('app');
            } else {
                setPendingAction('download-app');
            }

            try {
                await desktopUpdate.updateAndRestart();
            } finally {
                setPendingAction('none');
            }
            return;
        }

        if (needsRuntimeUpdate) {
            if (runtimeUpdateStatus.data?.phase !== 'staged') {
                setPendingAction('stage-runtime');
                try {
                    await startRuntimeUpdate.mutateAsync();
                    await waitForRuntimeUpdateStaged({
                        getStatus: () => utils.agentRuntime.updateStatus.fetch(),
                    });
                } finally {
                    setPendingAction('none');
                }
            }

            const desktopAction = getRuntimeUpdateDesktopAction(desktopUpdate.status);

            if (desktopAction === 'download-app-before-runtime-restart') {
                setPendingAction('download-app');
                try {
                    await desktopUpdate.updateAndRestart();
                } finally {
                    setPendingAction('none');
                }
                return;
            }

            setFinalRestartPhase('runtime');
            await restartRuntime.mutateAsync();
            await waitForRuntimeVersion({
                getStatus: () => utils.agentRuntime.updateStatus.fetch(),
                requiredVersion: runtimeConnection.connection?.requiredRuntimeVersion ?? null,
            });

            if (desktopAction === 'restart-app-after-runtime-restart') {
                setFinalRestartPhase('app');
                await desktopUpdate.updateAndRestart();
                return;
            }

            setFinalRestartPhase('idle');
            await utils.agentRuntime.get.invalidate();
            return;
        }

        if (desktopUpdate.status.phase !== 'ready') {
            setPendingAction('download-app');
            try {
                await desktopUpdate.updateAndRestart();
            } finally {
                setPendingAction('none');
            }
            return;
        }

        setFinalRestartPhase('app');
        await desktopUpdate.updateAndRestart();
    }, [
        appNeedsUpdate,
        desktopUpdate,
        needsRuntimeUpdate,
        restartRuntime,
        runtimeConnection.connection?.requiredRuntimeVersion,
        runtimeUpdateStatus.data,
        startRuntimeUpdate,
        utils.agentRuntime.get,
        utils.agentRuntime.updateStatus,
    ]);

    return {
        checkForUpdate: desktopUpdate.checkForUpdate,
        status,
        updateAndRestart,
    };
}

export function getRuntimeUpdateDesktopAction(status: DesktopUpdateStatus) {
    if (status.phase === 'available') {
        return 'download-app-before-runtime-restart';
    }

    if (status.phase === 'ready') {
        return 'restart-app-after-runtime-restart';
    }

    return 'none';
}

export function getTavernUpdateStatus(input: {
    desktopUpdateStatus: DesktopUpdateStatus;
    appNeedsUpdate: boolean;
    finalRestartPhase: 'idle' | 'runtime' | 'app';
    isRuntimeDisconnected: boolean;
    needsRuntimeUpdate: boolean;
    pendingAction?: TavernUpdatePendingAction;
    runtimeConnection: AgentRuntimeConnectionOutput;
    runtimeUpdateError: null | string;
    runtimeUpdateStatus: null | {
        currentVersion: string;
        message: null | string;
        phase: 'failed' | 'idle' | 'installing' | 'restarting' | 'staged';
        targetVersion: null | string;
    };
}): TavernUpdateStatus {
    const pendingStatus = getPendingUpdateStatus(input);
    if (pendingStatus) {
        return pendingStatus;
    }

    if (input.runtimeUpdateError) {
        return { detail: input.runtimeUpdateError, phase: 'failed' };
    }

    if (input.finalRestartPhase === 'runtime') {
        return {
            detail: 'Restarting Grotto Runtime. Grotto will restart after Runtime is reachable.',
            phase: 'restarting-runtime',
            version: getRuntimeTargetVersion(input.runtimeConnection),
        };
    }

    if (input.finalRestartPhase === 'app') {
        return {
            detail: 'Runtime is ready. Restarting Grotto.',
            phase: 'restarting-app',
            version: getDesktopVersion(input.desktopUpdateStatus),
        };
    }

    const desktopStatus = fromDesktopUpdateStatus(input.desktopUpdateStatus);
    if (input.appNeedsUpdate) {
        if (
            desktopStatus.phase !== 'idle' &&
            desktopStatus.phase !== 'unsupported' &&
            desktopStatus.phase !== 'runtime-disconnected'
        ) {
            return desktopStatus.phase === 'ready'
                ? {
                      ...desktopStatus,
                      detail: `Grotto v${desktopStatus.version} is ready. Click to install and restart.`,
                  }
                : desktopStatus;
        }

        return {
            detail: 'This Grotto app is not compatible with the connected Runtime. Install the latest Grotto update to continue.',
            phase: 'app-update-required',
        };
    }

    if (
        input.isRuntimeDisconnected &&
        desktopStatus.phase !== 'idle' &&
        desktopStatus.phase !== 'unsupported'
    ) {
        return desktopStatus;
    }

    if (input.isRuntimeDisconnected) {
        return {
            detail: 'Grotto Runtime is disconnected.',
            phase: 'runtime-disconnected',
        };
    }

    if (input.needsRuntimeUpdate) {
        if (input.runtimeUpdateStatus?.phase === 'failed') {
            return {
                detail:
                    input.runtimeUpdateStatus.message ??
                    `Grotto Runtime v${getRuntimeTargetVersion(input.runtimeConnection)} could not download. Click to try again.`,
                phase: 'available',
                version: getRuntimeTargetVersion(input.runtimeConnection),
            };
        }

        if (input.runtimeUpdateStatus?.phase === 'installing') {
            return {
                detail:
                    input.runtimeUpdateStatus.message ??
                    `Downloading Grotto Runtime v${getRuntimeTargetVersion(input.runtimeConnection)}.`,
                phase: 'staging-runtime',
                version: getRuntimeTargetVersion(input.runtimeConnection),
            };
        }

        if (input.runtimeUpdateStatus?.phase === 'staged') {
            if (
                input.desktopUpdateStatus.phase === 'current' ||
                input.desktopUpdateStatus.phase === 'unsupported'
            ) {
                return {
                    detail: `Grotto Runtime v${getRuntimeTargetVersion(input.runtimeConnection)} is ready. Click to restart runtime.`,
                    phase: 'ready',
                    version: getRuntimeTargetVersion(input.runtimeConnection),
                };
            }

            const desktopStatusWithRuntimeRestart = fromDesktopUpdateStatus(
                input.desktopUpdateStatus
            );
            return desktopStatusWithRuntimeRestart.phase === 'ready'
                ? {
                      ...desktopStatusWithRuntimeRestart,
                      detail: `Grotto v${desktopStatusWithRuntimeRestart.version} is ready. Click to install and restart.`,
                  }
                : desktopStatusWithRuntimeRestart;
        }

        return {
            detail: `The Grotto Runtime is ready to update to v${getRuntimeTargetVersion(input.runtimeConnection)}. Click to download.`,
            phase: 'available',
            version: getRuntimeTargetVersion(input.runtimeConnection),
        };
    }

    return desktopStatus;
}

function getPendingUpdateStatus(input: {
    desktopUpdateStatus: DesktopUpdateStatus;
    pendingAction?: TavernUpdatePendingAction;
    runtimeConnection: AgentRuntimeConnectionOutput;
}): TavernUpdateStatus | null {
    if (input.pendingAction === 'download-app') {
        const version = getDesktopVersion(input.desktopUpdateStatus);
        const progress =
            input.desktopUpdateStatus.phase === 'downloading'
                ? input.desktopUpdateStatus.progress
                : 0;

        return {
            detail:
                version === 'latest'
                    ? 'Downloading Grotto update.'
                    : `Downloading Grotto v${version}.`,
            phase: 'downloading-app',
            progress,
            version,
        };
    }

    if (input.pendingAction === 'stage-runtime') {
        const version = getRuntimeTargetVersion(input.runtimeConnection);

        return {
            detail:
                version === 'latest'
                    ? 'Downloading Grotto Runtime.'
                    : `Downloading Grotto Runtime v${version}.`,
            phase: 'staging-runtime',
            version,
        };
    }

    return null;
}

function fromDesktopUpdateStatus(status: DesktopUpdateStatus): TavernUpdateStatus {
    switch (status.phase) {
        case 'available':
            return {
                detail: `Grotto v${status.version} is ready to download.`,
                phase: 'available',
                version: status.version,
            };
        case 'checking':
            return { detail: 'Checking for Grotto updates.', phase: 'checking' };
        case 'current':
            return { detail: 'Grotto is up to date.', phase: 'idle' };
        case 'downloading':
            return {
                detail: `Downloading Grotto v${status.version}.`,
                phase: 'downloading-app',
                progress: status.progress,
                version: status.version,
            };
        case 'ready':
            return {
                detail: `Grotto v${status.version} is ready. Click to install and restart.`,
                phase: 'ready',
                version: status.version,
            };
        case 'error':
            return { detail: status.message, phase: 'failed' };
        case 'restarting':
            return {
                detail: 'Restarting Grotto.',
                phase: 'restarting-app',
                version: status.version,
            };
        case 'unsupported':
            return {
                detail: 'Updates are available in the packaged Mac app.',
                phase: 'unsupported',
            };
        default:
            return { detail: 'Grotto update monitor is idle.', phase: 'idle' };
    }
}

function getRuntimeTargetVersion(connection: AgentRuntimeConnectionOutput) {
    return connection?.requiredRuntimeVersion ?? 'latest';
}

function getDesktopVersion(status: DesktopUpdateStatus) {
    return 'version' in status ? status.version : 'latest';
}

async function waitForRuntimeVersion(input: {
    getStatus: () => Promise<{
        currentVersion: string;
    }>;
    requiredVersion: null | string;
}) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        try {
            const status = await input.getStatus();
            if (
                !input.requiredVersion ||
                compareVersions(status.currentVersion, input.requiredVersion) >= 0
            ) {
                return;
            }
        } catch {}

        await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    throw new Error('Runtime did not become reachable after restart.');
}

async function waitForRuntimeUpdateStaged(input: {
    getStatus: () => Promise<{
        message: null | string;
        phase: 'failed' | 'idle' | 'installing' | 'restarting' | 'staged';
    }>;
}) {
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
        const status = await input.getStatus();
        if (status.phase === 'staged') {
            return;
        }
        if (status.phase === 'failed') {
            throw new Error(status.message ?? 'Runtime update failed.');
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    throw new Error('Runtime update did not finish staging in time.');
}
