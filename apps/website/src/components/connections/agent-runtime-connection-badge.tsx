import { Chip } from '@heroui/react';
import {
    type RuntimeConnectionStatus,
    useRuntimeConnection,
} from '../../hooks/connections/use-runtime-connection.ts';
import type { AgentRuntimeConnectionOutput } from '../../lib/trpc.tsx';
import { StatusDot } from '../ui/status-dot.tsx';

function getAgentRuntimeTitle(
    status: RuntimeConnectionStatus,
    connection: AgentRuntimeConnectionOutput
) {
    if (connection) {
        return `${status}: ${connection.baseUrl}`;
    }

    if (status === 'checking') {
        return 'Loading Grotto Runtime status.';
    }

    if (status === 'error') {
        return 'Could not load saved Grotto Runtime state.';
    }

    return 'Grotto is running on synced data only.';
}

export function AgentRuntimeConnectionBadge() {
    const { connection, status } = useRuntimeConnection();
    const isLive = status === 'reachable';
    const isChecking = status === 'checking';

    return (
        <Chip
            className="pointer-events-auto"
            color={isLive ? 'success' : 'default'}
            size="sm"
            title={getAgentRuntimeTitle(status, connection)}
            variant="soft"
        >
            <StatusDot
                className={isChecking ? 'motion-safe:animate-pulse' : undefined}
                pulse={isLive}
                size="md"
                status={isLive ? 'success' : 'muted'}
            />
            <Chip.Label>{isLive ? 'Live' : isChecking ? 'Checking' : 'Disconnected'}</Chip.Label>
        </Chip>
    );
}
