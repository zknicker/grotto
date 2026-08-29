import type { AgentReasoningEffort } from '@grotto/api';
import { Chip } from '@heroui/react';
import { LowSignalIcon, MediumSignalIcon, SignalFull02Icon } from '@hugeicons/core-free-icons';
import type { HugeiconsIconProps } from '@hugeicons/react';
import { ModelProviderBadge } from '../../components/badges/model-provider-badge.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { titleCase } from '../../lib/format.ts';
import { getModelProviderConfig } from '../../lib/model-provider-config.ts';

export function AgentExecutionChips({
    modelLabel,
    reasoningEffort,
    runtimeId,
    runtimeLabel,
}: {
    modelLabel: string;
    reasoningEffort: AgentReasoningEffort;
    runtimeId: string;
    runtimeLabel: string;
}) {
    const runtimeProvider = getModelProviderConfig(runtimeId);
    const reasoningLabel = titleCase(reasoningEffort);
    const reasoning = reasoningPresentation[reasoningEffort];

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-1">
            <ModelProviderBadge
                aria-label={`Runtime: ${runtimeLabel}; model: ${modelLabel}`}
                className="max-w-full"
                color={runtimeProvider.color}
                icon={runtimeProvider.icon}
                label={`${runtimeLabel} · ${modelLabel}`}
                logo={runtimeProvider.logo}
                size="sm"
            />
            <Chip data-reasoning-effort={reasoningEffort} size="sm" variant="secondary">
                <Icon
                    className={`size-3.5 ${reasoning.colorClassName}`}
                    icon={reasoning.icon}
                    strokeWidth={2}
                />
                <Chip.Label className={reasoning.colorClassName}>
                    {reasoningLabel}
                    <span className="sr-only">, {reasoning.stage} of 3</span>
                </Chip.Label>
            </Chip>
        </div>
    );
}

const reasoningPresentation = {
    high: {
        colorClassName: 'text-reasoning-high',
        icon: SignalFull02Icon,
        stage: 3,
    },
    low: {
        colorClassName: 'text-reasoning-low',
        icon: LowSignalIcon,
        stage: 1,
    },
    medium: {
        colorClassName: 'text-reasoning-medium',
        icon: MediumSignalIcon,
        stage: 2,
    },
} satisfies Record<
    AgentReasoningEffort,
    {
        colorClassName: string;
        icon: HugeiconsIconProps['icon'];
        stage: number;
    }
>;
