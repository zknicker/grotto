import { Badge } from '../../../components/ui/badge.tsx';
import { DrawerHeader, DrawerTitle } from '../../../components/ui/drawer.tsx';
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
        <DrawerHeader>
            <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-muted">
                    <Icon
                        className="size-4.5 text-muted-foreground"
                        icon={resolveToolDrawerIcon(call.name)}
                        strokeWidth={1.5}
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                        <DrawerTitle className="truncate">{titleCase(call.name)}</DrawerTitle>
                        {hasError ? (
                            <Badge variant="destructive">Failed</Badge>
                        ) : isRunning ? (
                            <Badge variant="secondary">Running</Badge>
                        ) : null}
                    </div>
                    {metadata ? (
                        <p className="mt-0.5 font-mono text-muted-foreground text-sm tabular-nums">
                            {metadata}
                        </p>
                    ) : null}
                </div>
            </div>
        </DrawerHeader>
    );
}
