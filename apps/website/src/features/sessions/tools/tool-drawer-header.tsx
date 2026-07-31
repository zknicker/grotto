import { Chip, Drawer } from '@heroui/react';
import { Icon } from '../../../components/ui/icon.tsx';
import { formatShortTime, titleCase } from '../../../lib/format.ts';
import type { ToolDrawerCall } from './tool-drawer-call.ts';
import { resolveToolDrawerIcon } from './tool-drawer-registry.tsx';
import { formatToolDuration, hasErrorStatus } from './tool-ui.ts';

export function ToolDrawerHeader({ call }: { call: ToolDrawerCall }) {
    const hasError = hasErrorStatus(call.status);
    const isRunning = !(call.completedAt || hasError);
    const startedTime = formatShortTime(call.startedAt);
    const duration = formatToolDuration(call.startedAt, call.completedAt);
    const metadata = [startedTime, duration].filter(Boolean).join(' · ');

    return (
        <Drawer.Header>
            <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-separator bg-surface-secondary">
                    <Icon
                        className="size-4.5 text-muted"
                        icon={resolveToolDrawerIcon(call.name)}
                        strokeWidth={1.5}
                    />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <Drawer.Heading>{titleCase(call.name)}</Drawer.Heading>
                        {hasError ? (
                            <Chip color="danger" size="sm" variant="soft">
                                Failed
                            </Chip>
                        ) : isRunning ? (
                            <Chip size="sm" variant="secondary">
                                Running
                            </Chip>
                        ) : null}
                    </div>
                    {metadata ? (
                        <p className="font-mono text-muted text-sm tabular-nums">{metadata}</p>
                    ) : null}
                </div>
            </div>
        </Drawer.Header>
    );
}
