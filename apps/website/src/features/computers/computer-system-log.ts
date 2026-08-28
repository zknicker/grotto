import type { ComputerSystemEvent } from '@grotto/api';

export const disconnectWarningThreshold = 5;
export const disconnectWarningWindowMs = 5 * 60_000;

export function hasFrequentDisconnects(events: ComputerSystemEvent[], now = Date.now()) {
    const cutoff = now - disconnectWarningWindowMs;
    return (
        events.filter(
            (event) => event.type === 'disconnected' && Date.parse(event.occurredAt) >= cutoff
        ).length >= disconnectWarningThreshold
    );
}

export function systemEventLabel(event: ComputerSystemEvent) {
    switch (event.type) {
        case 'connected':
            return 'Connected to Server';
        case 'disconnected':
            return 'Disconnected from Server';
        case 'management-command':
            return commandEventLabel(event.command);
    }
}

function commandEventLabel(
    command: Extract<ComputerSystemEvent, { type: 'management-command' }>['command']
) {
    switch (command) {
        case 'start':
            return 'Computer started';
        case 'stop':
            return 'Computer stopped';
        case 'restart':
            return 'Computer restarted';
        case 'upgrade':
            return 'Computer upgraded';
        case 'rollback':
            return 'Computer rolled back';
    }
}
