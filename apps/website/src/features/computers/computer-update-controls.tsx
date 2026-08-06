import { Button, ProgressBar } from '@heroui/react';
import { useComputerUpdateCheck } from '../../hooks/servers/use-computer-update-check.ts';
import { useComputerUpdateStart } from '../../hooks/servers/use-computer-update-start.ts';
import type { GrottoOutputs } from '../../lib/grotto-server.tsx';
import { computerUpdateView } from './computer-update-model.ts';

type Computer = GrottoOutputs['computer']['list'][number];

export function ComputerUpdateControls({
    computer,
    serverId,
}: {
    computer: Computer;
    serverId: string;
}) {
    const check = useComputerUpdateCheck(serverId);
    const update = useComputerUpdateStart(serverId, computer.id);
    const view = computerUpdateView({
        health: computer.health,
        isChecking: check.isPending || update.isPending,
        phase: computer.updatePhase,
        targetVersion: computer.updateTargetVersion,
    });
    const isUpdateActive = [
        'requested',
        'downloading',
        'verifying',
        'waiting-for-agents',
        'installing',
        'restarting',
    ].includes(computer.updatePhase);
    const determinateValue =
        computer.updatePhase === 'downloading' &&
        computer.updateDownloadedBytes !== null &&
        computer.updateTotalBytes !== null
            ? (computer.updateDownloadedBytes / computer.updateTotalBytes) * 100
            : null;
    const versionSuffix = computer.updateTargetVersion ? ` ${computer.updateTargetVersion}` : '';

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p aria-live="polite" className="font-medium text-sm">
                        {computer.updatePhase === 'downloading'
                            ? `${view.label}${versionSuffix}`
                            : view.label}
                    </p>
                    <p className="text-muted text-sm">
                        {computer.updateDetail ??
                            (computer.updateTargetVersion
                                ? `Production v${computer.updateTargetVersion}`
                                : 'Check the latest production release.')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        isDisabled={!view.canCheck}
                        isPending={check.isPending}
                        onPress={() => check.mutate({ computerId: computer.id, serverId })}
                        size="sm"
                        variant="secondary"
                    >
                        Check
                    </Button>
                    <Button
                        isDisabled={!view.canUpdate}
                        isPending={update.isPending}
                        onPress={() => update.mutate({ computerId: computer.id, serverId })}
                        size="sm"
                    >
                        Update
                    </Button>
                </div>
            </div>
            {isUpdateActive ? (
                <div className="space-y-2 py-1">
                    <ProgressBar
                        aria-label={view.label}
                        isIndeterminate={determinateValue === null}
                        value={determinateValue ?? 0}
                    >
                        <ProgressBar.Track>
                            <ProgressBar.Fill />
                        </ProgressBar.Track>
                    </ProgressBar>
                    {computer.updatePhase === 'downloading' &&
                    computer.updateDownloadedBytes !== null ? (
                        <p className="font-mono text-muted text-xs tabular-nums">
                            {formatBytes(computer.updateDownloadedBytes)}
                            {computer.updateTotalBytes !== null
                                ? ` of ${formatBytes(computer.updateTotalBytes)}`
                                : ' downloaded'}
                        </p>
                    ) : null}
                    {computer.updatePhase === 'waiting-for-agents' &&
                    computer.updateActiveAgentCount !== null ? (
                        <p className="text-muted text-sm">
                            {computer.updateActiveAgentCount === 1
                                ? '1 active Agent is finishing.'
                                : `${computer.updateActiveAgentCount} active Agents are finishing.`}
                        </p>
                    ) : null}
                </div>
            ) : null}
            {view.needsLocalRecovery ? (
                <p className="text-warning text-xs">
                    {computer.health === 'update-required'
                        ? 'Ordinary controls are paused until this Computer updates. '
                        : 'If this Computer cannot reconnect, '}
                    Run <code>grotto-computer upgrade</code> locally.
                </p>
            ) : null}
            {computer.updatePhase === 'failed' ? (
                <p className="text-danger text-sm">
                    {computer.updateFailedPhase
                        ? `Failed while ${failedPhaseLabel(computer.updateFailedPhase)}. `
                        : ''}
                    Recover with <code>grotto-computer upgrade</code>.
                </p>
            ) : null}
            {check.error || update.error ? (
                <p className="text-danger text-xs">{(check.error ?? update.error)?.message}</p>
            ) : null}
        </div>
    );
}

function formatBytes(bytes: number) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function failedPhaseLabel(phase: Exclude<Computer['updatePhase'], 'failed'>) {
    return phase.replaceAll('-', ' ');
}
