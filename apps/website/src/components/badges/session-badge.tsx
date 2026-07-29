import { Layers02Icon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { Badge } from '../ui/badge.tsx';
import { Icon } from '../ui/icon.tsx';

export interface SessionBadgeProps {
    className?: string;
    sessionKey: string;
}

export function SessionBadge({ className, sessionKey }: SessionBadgeProps): React.ReactElement {
    return (
        <Badge
            className={className}
            data-slot="session-badge"
            size="chip"
            title={sessionKey}
            variant="chip"
        >
            <Icon className="size-4 shrink-0 text-muted-foreground" icon={Layers02Icon} />
            <span className="min-w-0 truncate font-mono">{sessionKey}</span>
        </Badge>
    );
}
