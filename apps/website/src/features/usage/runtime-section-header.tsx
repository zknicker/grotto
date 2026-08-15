import { Chip } from '@heroui/react';
import { ItemCardGroup } from '@heroui-pro/react';
import type { ComputerRuntimeId } from '@tavern/api';
import { ProviderMark } from '../../components/provider-mark.tsx';

export function RuntimeSectionHeader({
    detectedRuntimeIds,
}: {
    detectedRuntimeIds: ComputerRuntimeId[];
}) {
    const detectedRuntimeSet = new Set(detectedRuntimeIds);
    const undetectedRuntimeIds = runtimeIds.filter(
        (runtimeId) => !detectedRuntimeSet.has(runtimeId)
    );

    return (
        <ItemCardGroup.Header className="flex flex-wrap items-center justify-between gap-2">
            <ItemCardGroup.Title>Runtimes</ItemCardGroup.Title>
            {undetectedRuntimeIds.length > 0 ? (
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                    <p className="text-muted text-sm">Not Detected</p>
                    {undetectedRuntimeIds.map((runtimeId) => (
                        <Chip className="text-muted" key={runtimeId} size="sm" variant="soft">
                            <ProviderMark
                                className="size-4 fill-muted text-muted"
                                provider={runtimeId}
                            />
                            <Chip.Label>{runtimeLabels[runtimeId]}</Chip.Label>
                        </Chip>
                    ))}
                </div>
            ) : null}
        </ItemCardGroup.Header>
    );
}

const runtimeIds: ComputerRuntimeId[] = ['codex', 'claude-code', 'grok-build', 'pi'];

const runtimeLabels: Record<ComputerRuntimeId, string> = {
    'claude-code': 'Claude Code',
    codex: 'Codex',
    'grok-build': 'Grok Build',
    pi: 'Pi',
};
