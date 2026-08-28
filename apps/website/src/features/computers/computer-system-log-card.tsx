import type { ComputerSystemEvent } from '@grotto/api';
import { Alert } from '@heroui/react';
import { DataGrid, type DataGridColumn, ItemCardGroup } from '@heroui-pro/react';
import { useComputerSystemLog } from '../../hooks/servers/use-computer-system-log.ts';
import { hasFrequentDisconnects, systemEventLabel } from './computer-system-log.ts';

interface ComputerSystemEventRow {
    event: string;
    id: string;
    occurredAt: string;
}

export function ComputerSystemLog({
    computerId,
    serverId,
}: {
    computerId: string;
    serverId: string;
}) {
    const systemLog = useComputerSystemLog(serverId, computerId);
    const events = systemLog.data ?? [];
    const rows = events.map(systemEventRow);

    return (
        <section>
            <ItemCardGroup variant="transparent">
                <ItemCardGroup.Header>
                    <ItemCardGroup.Title>System Log</ItemCardGroup.Title>
                </ItemCardGroup.Header>
                {hasFrequentDisconnects(events) ? (
                    <Alert status="warning">
                        <Alert.Indicator />
                        <Alert.Content>
                            <Alert.Title>Frequent disconnects</Alert.Title>
                            <Alert.Description>
                                This Computer disconnected at least five times in the last five
                                minutes.
                            </Alert.Description>
                        </Alert.Content>
                    </Alert>
                ) : null}
                {systemLog.isError ? (
                    <p className="text-danger text-sm">System log unavailable.</p>
                ) : systemLog.isPending ? (
                    <div aria-busy="true" className="min-h-14">
                        <span className="sr-only">Loading Computer system log</span>
                    </div>
                ) : rows.length > 0 ? (
                    <DataGrid
                        aria-label="Computer system log"
                        columns={systemEventColumns}
                        data={rows}
                        getRowId={(item) => item.id}
                    />
                ) : (
                    <p className="text-muted text-sm">No system events recorded yet.</p>
                )}
            </ItemCardGroup>
        </section>
    );
}

function systemEventRow(event: ComputerSystemEvent): ComputerSystemEventRow {
    return { event: systemEventLabel(event), id: event.id, occurredAt: event.occurredAt };
}

const systemEventColumns: DataGridColumn<ComputerSystemEventRow>[] = [
    {
        accessorKey: 'event',
        header: 'Event',
        id: 'event',
        isRowHeader: true,
        minWidth: 220,
    },
    {
        align: 'end',
        cell: (item) => (
            <time className="text-muted tabular-nums" dateTime={item.occurredAt}>
                {formatTimestamp(item.occurredAt)}
            </time>
        ),
        header: 'Time',
        id: 'occurredAt',
        minWidth: 180,
    },
];

function formatTimestamp(value: string) {
    return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
        timeZoneName: 'short',
        year: 'numeric',
    }).format(new Date(value));
}
