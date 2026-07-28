import type {
    ComputerUpdatePhase,
    HostedAgentCommand,
    HostedAgentSkillMetadata,
    HostedAgentWorkspaceRequest,
    HostedAgentWorkspaceResult,
    SignedComputerRelease,
} from '@tavern/api';
import type { DeliveryTransport } from '../agent-delivery/delivery.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';

interface AttachedComputer {
    disconnect?(): void;
    ordinary: boolean;
    send(frame: unknown): void;
    serverId: string;
    updatePhase: ComputerUpdatePhase;
}

interface PendingSkillImport {
    agentId: string;
    computerId: string;
    reject(error: Error): void;
    resolve(skill: HostedAgentSkillMetadata): void;
    timeout: ReturnType<typeof setTimeout>;
}

interface PendingWorkspaceRequest {
    agentId: string;
    computerId: string;
    reject(error: Error): void;
    resolve(result: NonNullable<HostedAgentWorkspaceResult['result']>): void;
    timeout: ReturnType<typeof setTimeout>;
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
    private readonly pendingSkillImports = new Map<string, PendingSkillImport>();
    private readonly pendingWorkspaceRequests = new Map<string, PendingWorkspaceRequest>();

    register(computerId: string, computer: AttachedComputer): void {
        this.attached.set(computerId, computer);
    }

    unregister(computerId: string): void {
        this.attached.delete(computerId);
        for (const [requestId, pending] of this.pendingSkillImports) {
            if (pending.computerId === computerId) {
                clearTimeout(pending.timeout);
                this.pendingSkillImports.delete(requestId);
                pending.reject(new Error('The selected Computer went offline.'));
            }
        }
        for (const [requestId, pending] of this.pendingWorkspaceRequests) {
            if (pending.computerId === computerId) {
                clearTimeout(pending.timeout);
                this.pendingWorkspaceRequests.delete(requestId);
                pending.reject(new Error('The selected Computer went offline.'));
            }
        }
    }

    isOnline(computerId: string): boolean {
        const computer = this.attached.get(computerId);
        return Boolean(
            computer?.ordinary &&
                !['waiting-for-agents', 'installing', 'restarting'].includes(computer.updatePhase)
        );
    }

    /** Sends cleanup to every online Computer for a Server, then disconnects it without waiting. */
    cleanupServer(serverId: string): number {
        let sent = 0;
        for (const [computerId, computer] of this.attached) {
            if (computer.serverId !== serverId) {
                continue;
            }
            this.unregister(computerId);
            try {
                computer.send({ type: 'server-delete' });
                sent += 1;
            } catch {
                // Closing sockets and offline Computers never delay Server deletion.
            }
            try {
                computer.disconnect?.();
            } catch {
                // The credential is already revoked; disconnect is best-effort.
            }
        }
        return sent;
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

    requestSkillImport(
        computerId: string,
        input: { agentId: string; sourceId: string }
    ): Promise<HostedAgentSkillMetadata> {
        const requestId = createOpaqueId('req');
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingSkillImports.delete(requestId);
                reject(new Error('The Computer did not finish the skill import.'));
            }, 30_000);
            this.pendingSkillImports.set(requestId, {
                agentId: input.agentId,
                computerId,
                reject,
                resolve,
                timeout,
            });
            if (
                !this.send(computerId, {
                    ...input,
                    requestId,
                    type: 'agent-skill-import',
                })
            ) {
                clearTimeout(timeout);
                this.pendingSkillImports.delete(requestId);
                reject(new Error('The selected Computer is offline.'));
            }
        });
    }

    acceptSkillImport(
        computerId: string,
        result: {
            agentId: string;
            error?: string;
            requestId: string;
            skill?: HostedAgentSkillMetadata;
        }
    ): boolean {
        const pending = this.pendingSkillImports.get(result.requestId);
        if (!pending || pending.computerId !== computerId || pending.agentId !== result.agentId) {
            return false;
        }
        clearTimeout(pending.timeout);
        this.pendingSkillImports.delete(result.requestId);
        if (result.skill) {
            pending.resolve(result.skill);
        } else {
            pending.reject(new Error(result.error ?? 'The skill could not be imported.'));
        }
        return true;
    }

    requestWorkspace(
        computerId: string,
        input: {
            agentId: string;
            operation: HostedAgentWorkspaceRequest['operation'];
        }
    ): Promise<NonNullable<HostedAgentWorkspaceResult['result']>> {
        const requestId = createOpaqueId('req');
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingWorkspaceRequests.delete(requestId);
                reject(new Error('The Computer did not answer the workspace request.'));
            }, 10_000);
            this.pendingWorkspaceRequests.set(requestId, {
                agentId: input.agentId,
                computerId,
                reject,
                resolve,
                timeout,
            });
            if (
                !this.send(computerId, {
                    ...input,
                    requestId,
                    type: 'agent-workspace-request',
                })
            ) {
                clearTimeout(timeout);
                this.pendingWorkspaceRequests.delete(requestId);
                reject(new Error('The selected Computer is offline.'));
            }
        });
    }

    acceptWorkspaceResult(computerId: string, result: HostedAgentWorkspaceResult): boolean {
        const pending = this.pendingWorkspaceRequests.get(result.requestId);
        if (!pending || pending.computerId !== computerId || pending.agentId !== result.agentId) {
            return false;
        }
        clearTimeout(pending.timeout);
        this.pendingWorkspaceRequests.delete(result.requestId);
        if (result.result) {
            pending.resolve(result.result);
        } else {
            pending.reject(new Error(result.error ?? 'The workspace request failed.'));
        }
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
