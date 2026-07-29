import { SecureStorageBadge } from '../../../components/badges/secure-storage-badge.tsx';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import { cn } from '../../../lib/utils.ts';

type ConnectionState = 'error' | 'live' | 'needs-auth';
export type ConnectionTarget = 'secure-storage';

interface ProviderConnectionDescriptionProps {
    description: string;
    state: ConnectionState;
    target?: ConnectionTarget;
}

export function ProviderConnectionDescription({
    description,
    state,
    target,
}: ProviderConnectionDescriptionProps) {
    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta">
            <ProviderConnectionStatus state={state} />
            <ProviderConnectionDetail description={description} state={state} target={target} />
        </div>
    );
}

export function ProviderConnectionStatus({ state }: { state: ConnectionState }) {
    return (
        <span className={cn('inline-flex items-center gap-1.5', getStatusTextClass(state))}>
            <StatusDot size="sm" status={getStatusDotTone(state)} />
            {getStatusLabel(state)}
        </span>
    );
}

export function ProviderConnectionDetail({
    description,
    state,
    target,
}: ProviderConnectionDescriptionProps) {
    if (state === 'live' && target) {
        return <SecureStorageBadge />;
    }

    return description ? <span className="text-muted-foreground">{description}</span> : null;
}

function getStatusDotTone(state: ConnectionState) {
    switch (state) {
        case 'live':
            return 'success' as const;
        case 'error':
            return 'error' as const;
        case 'needs-auth':
            return 'error' as const;
    }
}

function getStatusLabel(state: ConnectionState) {
    switch (state) {
        case 'live':
            return 'Connected';
        case 'error':
            return 'Error';
        case 'needs-auth':
            return 'Not connected';
    }
}

function getStatusTextClass(state: ConnectionState) {
    switch (state) {
        case 'live':
            return 'text-success-foreground';
        case 'error':
            return 'text-destructive';
        case 'needs-auth':
            return 'text-muted-foreground';
    }
}
