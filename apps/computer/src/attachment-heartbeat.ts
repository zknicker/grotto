import type { ComputerHeartbeatConfiguration } from '@grotto/api';

export interface AttachmentHeartbeat {
    acceptAck(id: number): void;
    dispose(): void;
}

export function startAttachmentHeartbeat(input: {
    configuration: ComputerHeartbeatConfiguration;
    onTimeout?: () => void;
    socket: WebSocket;
}): AttachmentHeartbeat {
    const { configuration, onTimeout, socket } = input;
    let deadline: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let highestAcceptedId = -1;
    let highestSentId = -1;
    let interval: ReturnType<typeof setInterval> | null = null;
    let lastAckAt = Date.now();

    const dispose = () => {
        if (disposed) {
            return;
        }
        disposed = true;
        if (interval) {
            clearInterval(interval);
        }
        if (deadline) {
            clearTimeout(deadline);
        }
    };
    const terminate = () => {
        if (disposed) {
            return;
        }
        onTimeout?.();
        dispose();
        socket.terminate();
    };
    const scheduleDeadline = () => {
        if (deadline) {
            clearTimeout(deadline);
        }
        deadline = setTimeout(terminate, configuration.timeoutMs);
    };
    const sendHeartbeat = () => {
        if (Date.now() - lastAckAt >= configuration.timeoutMs) {
            terminate();
            return;
        }
        if (socket.readyState !== WebSocket.OPEN) {
            return;
        }
        highestSentId += 1;
        socket.send(JSON.stringify({ id: highestSentId, type: 'heartbeat' }));
    };

    scheduleDeadline();
    sendHeartbeat();
    interval = setInterval(sendHeartbeat, configuration.intervalMs);

    return {
        acceptAck(id) {
            if (disposed || id <= highestAcceptedId || id > highestSentId) {
                return;
            }
            highestAcceptedId = id;
            lastAckAt = Date.now();
            scheduleDeadline();
        },
        dispose,
    };
}
