import type { HostedAgentCommand } from '@tavern/api';
import type { DeliveryTransport } from '../agent-delivery/delivery.ts';

interface AttachedComputer {
    send(frame: unknown): void;
    serverId: string;
}

/**
 * The live registry of Computer attachment sockets — the Server→Computer side of
 * the typed protocol. It is pure transport: durable run, stop, and pending state
 * live in PostgreSQL and are owned by {@link AgentDelivery}. The socket layer
 * registers each accepted attachment; delivery resolves the target Computer and
 * hands a typed frame here to send.
 */
export class ComputerConnections implements DeliveryTransport {
    private readonly attached = new Map<string, AttachedComputer>();

    register(computerId: string, computer: AttachedComputer): void {
        this.attached.set(computerId, computer);
    }

    unregister(computerId: string): void {
        this.attached.delete(computerId);
    }

    isOnline(computerId: string): boolean {
        return this.attached.has(computerId);
    }

    /** Sends a typed frame to the Computer, reporting whether it was online. */
    send(computerId: string, frame: HostedAgentCommand): boolean {
        const computer = this.attached.get(computerId);
        if (!computer) {
            return false;
        }
        computer.send(frame);
        return true;
    }
}
