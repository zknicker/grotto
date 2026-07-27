import { Button } from '../../components/ui/primitives/button.tsx';
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
    });

    return (
        <div className="flex flex-col gap-2 border-border border-t pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="font-medium text-sm">{view.label}</p>
                    <p className="text-muted-foreground text-xs">
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
            {view.needsLocalRecovery ? (
                <p className="text-warning-foreground text-xs">
                    {computer.health === 'update-required'
                        ? 'Ordinary controls are paused until this Computer updates. '
                        : 'If this Computer cannot reconnect, '}
                    Run <code>grotto-computer upgrade</code> locally.
                </p>
            ) : null}
            {update.error ? (
                <p className="text-error-foreground text-xs">{update.error.message}</p>
            ) : null}
        </div>
    );
}
