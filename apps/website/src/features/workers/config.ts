import type { IconSvgElement } from '@hugeicons/react';
import {
    HourglassIcon,
    Robot02Icon,
    TerminalIcon,
    ZapIcon,
} from '@hugeicons-pro/core-duotone-rounded';
import type { WorkerListOutput } from '../../lib/trpc.tsx';

export const workerKindConfig = {
    acp: {
        accent: 'var(--accent)',
        accentMuted: 'oklch(from var(--accent) l c h / 0.25)',
        bg: 'bg-accent/10',
        icon: ZapIcon,
        label: 'ACP',
    },
    cli: {
        accent: 'var(--accent)',
        accentMuted: 'oklch(from var(--accent) l c h / 0.25)',
        bg: 'bg-accent/10',
        icon: TerminalIcon,
        label: 'CLI',
    },
    cron: {
        accent: 'var(--warning)',
        accentMuted: 'oklch(from var(--warning) l c h / 0.25)',
        bg: 'bg-warning/10',
        icon: HourglassIcon,
        label: 'Cron',
    },
    subagent: {
        accent: 'var(--success)',
        accentMuted: 'oklch(from var(--success) l c h / 0.25)',
        bg: 'bg-success/10',
        icon: Robot02Icon,
        label: 'Delegated',
    },
} satisfies Record<
    WorkerListOutput['workers'][number]['kind'],
    {
        accent: string;
        accentMuted: string;
        bg: string;
        icon: IconSvgElement;
        label: string;
    }
>;
