import { Button, Tooltip } from '@heroui/react';
import { ItemCard } from '@heroui-pro/react';
import type { GrottoOutputs } from '../../lib/grotto-server.tsx';
import { UpdateProgressBar } from '../updates/grotto-update-progress.tsx';
import { computerUpdateView } from './computer-update-model.ts';

export type ComputerUpdateComputer = GrottoOutputs['computer']['list'][number];

const activeUpdatePhases = new Set<ComputerUpdateComputer['updatePhase']>([
    'requested',
    'downloading',
    'verifying',
    'waiting-for-agents',
    'installing',
    'restarting',
]);

export function ComputerUpdateCard({
    computer,
    isChecking,
    isStarting,
    onCheck,
    onUpdate,
}: {
    computer: ComputerUpdateComputer;
    isChecking: boolean;
    isStarting: boolean;
    onCheck: () => void;
    onUpdate: () => void;
}) {
    const view = computerUpdateView({
        health: computer.health,
        isChecking: isChecking || isStarting,
        phase: computer.updatePhase,
        targetVersion: computer.updateTargetVersion,
    });
    const isUpdateActive = activeUpdatePhases.has(computer.updatePhase);
    const downloadProgress = computerDownloadProgress(computer);
    const showCheck = view.canCheck || isChecking || computer.updatePhase === 'checking';
    const showUpdate = view.canUpdate || isStarting;

    return (
        <ItemCard>
            <ItemCard.Content>
                <ItemCard.Title>Software Update</ItemCard.Title>
                <ItemCard.Description>
                    Check for and install the latest production release.
                </ItemCard.Description>
            </ItemCard.Content>
            <ItemCard.Action>
                {isUpdateActive ? (
                    <UpdateProgressBar label={view.label} progress={downloadProgress} />
                ) : (
                    <div className="flex items-center gap-2">
                        {/* An unreachable Computer still shows its control, disabled
                            and named for the reason, rather than an empty slot. */}
                        {view.canCheck || showCheck ? (
                            <Button
                                isDisabled={!view.canCheck}
                                isPending={isChecking || computer.updatePhase === 'checking'}
                                onPress={onCheck}
                                size="sm"
                                variant="secondary"
                            >
                                Check
                            </Button>
                        ) : (
                            <Tooltip delay={0}>
                                <Tooltip.Trigger aria-label={view.label}>
                                    <span className="inline-flex cursor-not-allowed">
                                        <Button isDisabled size="sm" variant="secondary">
                                            Offline
                                        </Button>
                                    </span>
                                </Tooltip.Trigger>
                                <Tooltip.Content showArrow>
                                    <Tooltip.Arrow />
                                    <p className="max-w-xs">
                                        Reconnect this Computer to check for updates.
                                    </p>
                                </Tooltip.Content>
                            </Tooltip>
                        )}
                        {showUpdate ? (
                            <Button
                                isDisabled={!view.canUpdate}
                                isPending={isStarting}
                                onPress={onUpdate}
                                size="sm"
                            >
                                {updateButtonLabel(computer.updateTargetVersion)}
                            </Button>
                        ) : null}
                    </div>
                )}
            </ItemCard.Action>
        </ItemCard>
    );
}

function updateButtonLabel(version: string | null) {
    if (!version) {
        return 'Update';
    }
    return `Update to ${version.startsWith('v') ? version : `v${version}`}`;
}

function computerDownloadProgress(computer: ComputerUpdateComputer) {
    if (
        computer.updatePhase !== 'downloading' ||
        computer.updateDownloadedBytes === null ||
        computer.updateTotalBytes === null ||
        computer.updateTotalBytes === 0
    ) {
        return null;
    }
    return computer.updateDownloadedBytes / computer.updateTotalBytes;
}
