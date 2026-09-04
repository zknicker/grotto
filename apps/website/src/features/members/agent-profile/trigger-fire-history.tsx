import type { TriggerFire } from '@grotto/api';
import type * as React from 'react';
import { formatTriggerFireDetail, formatTriggerFireTime } from './agent-trigger-model.ts';

/**
 * What has actually reached this Trigger, newest first. An unresolved read is
 * blank rather than an empty state: "no fires yet" is only true once the Server
 * has answered.
 */
export function TriggerFireHistory({
    action,
    fires,
    isPending,
}: {
    action: React.ReactNode;
    fires: TriggerFire[] | undefined;
    isPending: boolean;
}) {
    return (
        <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-foreground text-sm">Fire history</span>
                {action}
            </div>
            {isPending || !fires ? null : <TriggerFireList fires={fires} />}
        </div>
    );
}

function TriggerFireList({ fires }: { fires: TriggerFire[] }) {
    if (fires.length === 0) {
        return <p className="text-muted text-sm">Nothing has fired this trigger yet.</p>;
    }

    return (
        <ul className="max-h-64 overflow-y-auto">
            {fires.map((fire) => (
                <li className="flex items-baseline gap-2 py-1" key={fire.id}>
                    <span className="shrink-0 text-foreground text-sm tabular-nums">
                        {formatTriggerFireTime(fire)}
                    </span>
                    <span className="truncate text-muted text-sm tabular-nums">
                        {formatTriggerFireDetail(fire)}
                    </span>
                </li>
            ))}
        </ul>
    );
}
