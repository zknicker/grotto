import { Button } from '../../components/ui/primitives/button.tsx';
import { Progress } from '../../components/ui/progress.tsx';
import { useComputerUpdate } from '../../hooks/servers/use-computer-update.ts';
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
    const update = useComputerUpdate(serverId, computer.id);
    const view = computerUpdateView({
        health: computer.health,
        isChecking: update.isChecking || update.isStarting,
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
                    <p className="text-muted-foreground text-sm">
                        {computer.updateDetail ??
                            (computer.updateTargetVersion
                                ? `Production v${computer.updateTargetVersion}`
                                : 'Check the latest production release.')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        disabled={!view.canCheck}
                        loading={update.isChecking}
                        onClick={update.check}
                        size="sm"
                        variant="secondary"
                    >
                        Check
                    </Button>
                    <Button
                        disabled={!view.canUpdate}
                        loading={update.isStarting}
                        onClick={update.update}
                        size="sm"
                    >
                        Update
                    </Button>
                </div>
            </div>
            {isUpdateActive ? (
                <div className="space-y-2 py-1">
                    <Progress aria-label={view.label} className="h-4" value={determinateValue} />
                    {computer.updatePhase === 'downloading' &&
                    computer.updateDownloadedBytes !== null ? (
                        <p className="font-mono text-meta text-muted-foreground tabular-nums">
                            {formatBytes(computer.updateDownloadedBytes)}
                            {computer.updateTotalBytes !== null
                                ? ` of ${formatBytes(computer.updateTotalBytes)}`
                                : ' downloaded'}
                        </p>
                    ) : null}
                    {computer.updatePhase === 'waiting-for-agents' &&
                    computer.updateActiveAgentCount !== null ? (
                        <p className="text-muted-foreground text-sm">
                            {computer.updateActiveAgentCount === 1
                                ? '1 active Agent is finishing.'
                                : `${computer.updateActiveAgentCount} active Agents are finishing.`}
                        </p>
                    ) : null}
                </div>
            ) : null}
            {view.needsLocalRecovery ? (
                <p className="text-warning-foreground text-xs">
                    {computer.health === 'update-required'
                        ? 'Ordinary controls are paused until this Computer updates. '
                        : 'If this Computer cannot reconnect, '}
                    Run <code>grotto-computer upgrade</code> locally.
                </p>
            ) : null}
            {computer.updatePhase === 'failed' ? (
                <p className="text-error-foreground text-sm">
                    {computer.updateFailedPhase
                        ? `Failed while ${failedPhaseLabel(computer.updateFailedPhase)}. `
                        : ''}
                    Recover with <code>grotto-computer upgrade</code>.
                </p>
            ) : null}
            {update.error ? (
                <p className="text-error-foreground text-xs">{update.error.message}</p>
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
