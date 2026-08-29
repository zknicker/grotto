import type { ComputerSystemEvent } from '@grotto/api';

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
