import type { ComputerUpdatePhase, HostedAgentCommand, SignedComputerRelease } from '@tavern/api';
import type { DeliveryTransport } from '../agent-delivery/delivery.ts';

interface AttachedComputer {
    ordinary: boolean;
    send(frame: unknown): void;
    serverId: string;
    updatePhase: ComputerUpdatePhase;
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
        const computer = this.attached.get(computerId);
        return Boolean(
            computer?.ordinary &&
                !['waiting-for-agents', 'restarting'].includes(computer.updatePhase)
        );
    }

    /** Sends a typed frame to the Computer, reporting whether it was online. */
    send(computerId: string, frame: HostedAgentCommand): boolean {
        const computer = this.attached.get(computerId);
        if (!(computer?.ordinary && (frame.type === 'stop' || this.isOnline(computerId)))) {
            return false;
        }
        computer.send(frame);
        return true;
    }

    sendMcpConnection(computerId: string, connection: unknown): boolean {
        const computer = this.attached.get(computerId);
        if (!(this.isOnline(computerId) && computer)) {
            return false;
        }
        computer.send({ connection, type: 'mcp-upsert' });
        return true;
    }

    sendMcpGrant(computerId: string, grant: unknown): boolean {
        const computer = this.attached.get(computerId);
        if (!(this.isOnline(computerId) && computer)) {
            return false;
        }
        computer.send({ grant, type: 'mcp-grant' });
        return true;
    }

    setUpdatePhase(computerId: string, updatePhase: ComputerUpdatePhase): void {
        const computer = this.attached.get(computerId);
        if (computer) {
            computer.updatePhase = updatePhase;
        }
    }

    sendUpdate(computerId: string, release: SignedComputerRelease): boolean {
        const computer = this.attached.get(computerId);
        if (!computer) {
            return false;
        }
        computer.send({ release, type: 'update' });
        return true;
    }
}
