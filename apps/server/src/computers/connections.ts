import type {
    AgentCommand,
    AgentExecutionJournalResult,
    AgentSkillFileRequest,
    AgentSkillFileResult,
    AgentSkillImportResult,
    AgentWorkspaceRequest,
    AgentWorkspaceResult,
    BrowserRequest,
    BrowserResult,
    ComputerUpdatePhase,
    SignedComputerRelease,
} from '@tavern/api';
import type { DeliveryTransport } from '../agent-delivery/delivery.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { SkillFileRelay } from './skill-file-relay.ts';

interface AttachedComputer {
    disconnect?(reason: string): void;
    ordinary: boolean;
    send(frame: unknown): void;
    serverId: string;
    updatePhase: ComputerUpdatePhase;
}

interface PendingSkillImport {
    agentId: string;
    computerId: string;
    reject(error: Error): void;
    resolve(result: { requestId: string; status: 'accepted' }): void;
    sourceId: string;
}

interface PendingWorkspaceRequest {
    agentId: string;
    computerId: string;
    reject(error: Error): void;
    resolve(result: NonNullable<AgentWorkspaceResult['result']>): void;
    timeout: ReturnType<typeof setTimeout>;
}

interface PendingBrowserRequest {
    computerId: string;
    reject(error: Error): void;
    resolve(result: NonNullable<BrowserResult['result']>): void;
    timeout: ReturnType<typeof setTimeout>;
}

interface PendingExecutionJournalRequest {
    agentId: string;
    computerId: string;
    resolve(result: AgentExecutionJournalResult): void;
    runId: string;
    serverId: string;
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
    private readonly skillFileRelay = new SkillFileRelay((computerId, frame) =>
        this.send(computerId, frame)
    );
    private readonly pendingWorkspaceRequests = new Map<string, PendingWorkspaceRequest>();
    private readonly pendingBrowserRequests = new Map<string, PendingBrowserRequest>();
    private readonly pendingExecutionJournalRequests = new Map<
        string,
        PendingExecutionJournalRequest
    >();

    register(computerId: string, computer: AttachedComputer): void {
        this.attached.set(computerId, computer);
    }

    unregister(computerId: string): void {
        this.attached.delete(computerId);
        for (const [requestId, pending] of this.pendingSkillImports) {
            if (pending.computerId === computerId) {
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
        this.skillFileRelay.disconnect(computerId);
        for (const [requestId, pending] of this.pendingBrowserRequests) {
            if (pending.computerId === computerId) {
                clearTimeout(pending.timeout);
                this.pendingBrowserRequests.delete(requestId);
                pending.reject(new Error('The selected Computer went offline.'));
            }
        }
        for (const [requestId, pending] of this.pendingExecutionJournalRequests) {
            if (pending.computerId === computerId) {
                clearTimeout(pending.timeout);
                this.pendingExecutionJournalRequests.delete(requestId);
                pending.resolve({
                    agentId: pending.agentId,
                    reason: 'offline',
                    requestId,
                    runId: pending.runId,
                    status: 'unavailable',
                    type: 'agent-execution-journal-result',
                });
            }
        }
    }

    /** Drops one revoked Computer attachment without disturbing the Server's other Computers. */
    disconnectComputer(computerId: string): boolean {
        const computer = this.attached.get(computerId);
        if (!computer) {
            return false;
        }
        this.unregister(computerId);
        try {
            computer.disconnect?.('Computer removed');
        } catch {
            // The credential is already revoked; disconnect is best-effort.
        }
        return true;
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
                computer.disconnect?.('Server deleted');
            } catch {
                // The credential is already revoked; disconnect is best-effort.
            }
        }
        return sent;
    }

    /** Sends a typed frame to the Computer, reporting whether it was online. */
    send(computerId: string, frame: AgentCommand): boolean {
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
    ): Promise<{ requestId: string; status: 'accepted' }> {
        const requestId = createOpaqueId('req');
        return new Promise((resolve, reject) => {
            this.pendingSkillImports.set(requestId, {
                agentId: input.agentId,
                computerId,
                reject,
                resolve,
                sourceId: input.sourceId,
            });
            if (
                !this.send(computerId, {
                    ...input,
                    requestId,
                    type: 'agent-skill-import',
                })
            ) {
                this.pendingSkillImports.delete(requestId);
                reject(new Error('The selected Computer is offline.'));
            }
        });
    }

    acceptSkillImport(computerId: string, result: AgentSkillImportResult): boolean {
        const pending = this.pendingSkillImports.get(result.requestId);
        if (
            !pending ||
            pending.computerId !== computerId ||
            pending.agentId !== result.agentId ||
            pending.sourceId !== result.sourceId
        ) {
            return false;
        }
        this.pendingSkillImports.delete(result.requestId);
        if (result.status === 'accepted' || result.status === 'applied') {
            pending.resolve({ requestId: result.requestId, status: 'accepted' });
        } else {
            pending.reject(new Error(result.error));
        }
        return true;
    }

    requestSkillFile(
        computerId: string,
        input: {
            agentId: string;
            operation: AgentSkillFileRequest['operation'];
        }
    ): Promise<NonNullable<AgentSkillFileResult['result']>> {
        return this.skillFileRelay.request(computerId, input);
    }

    acceptSkillFileResult(computerId: string, result: AgentSkillFileResult): boolean {
        return this.skillFileRelay.accept(computerId, result);
    }

    requestWorkspace(
        computerId: string,
        input: {
            agentId: string;
            operation: AgentWorkspaceRequest['operation'];
        }
    ): Promise<NonNullable<AgentWorkspaceResult['result']>> {
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

    acceptWorkspaceResult(computerId: string, result: AgentWorkspaceResult): boolean {
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

    requestBrowser(
        computerId: string,
        operation: BrowserRequest['operation']
    ): Promise<NonNullable<BrowserResult['result']>> {
        const requestId = createOpaqueId('req');
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingBrowserRequests.delete(requestId);
                reject(new Error('The Computer did not answer the Browser request.'));
            }, 10_000);
            this.pendingBrowserRequests.set(requestId, {
                computerId,
                reject,
                resolve,
                timeout,
            });
            if (!this.send(computerId, { operation, requestId, type: 'browser-request' })) {
                clearTimeout(timeout);
                this.pendingBrowserRequests.delete(requestId);
                reject(new Error('The selected Computer is offline.'));
            }
        });
    }

    acceptBrowserResult(computerId: string, result: BrowserResult): boolean {
        const pending = this.pendingBrowserRequests.get(result.requestId);
        if (!pending || pending.computerId !== computerId) {
            return false;
        }
        clearTimeout(pending.timeout);
        this.pendingBrowserRequests.delete(result.requestId);
        if (result.result) {
            pending.resolve(result.result);
        } else {
            pending.reject(new Error(result.error ?? 'The Browser request failed.'));
        }
        return true;
    }

    requestExecutionJournal(
        computerId: string,
        input: { agentId: string; runId: string; serverId: string }
    ): Promise<AgentExecutionJournalResult> {
        const requestId = createOpaqueId('req');
        const computer = this.attached.get(computerId);
        if (!(computer?.serverId === input.serverId && this.isOnline(computerId))) {
            return Promise.resolve({
                agentId: input.agentId,
                reason: 'offline',
                requestId,
                runId: input.runId,
                status: 'unavailable',
                type: 'agent-execution-journal-result',
            });
        }
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.pendingExecutionJournalRequests.delete(requestId);
                resolve({
                    agentId: input.agentId,
                    reason: 'timeout',
                    requestId,
                    runId: input.runId,
                    status: 'unavailable',
                    type: 'agent-execution-journal-result',
                });
            }, 10_000);
            this.pendingExecutionJournalRequests.set(requestId, {
                agentId: input.agentId,
                computerId,
                resolve,
                runId: input.runId,
                serverId: input.serverId,
                timeout,
            });
            if (
                !this.send(computerId, {
                    agentId: input.agentId,
                    requestId,
                    runId: input.runId,
                    type: 'agent-execution-journal-request',
                })
            ) {
                clearTimeout(timeout);
                this.pendingExecutionJournalRequests.delete(requestId);
                resolve({
                    agentId: input.agentId,
                    reason: 'offline',
                    requestId,
                    runId: input.runId,
                    status: 'unavailable',
                    type: 'agent-execution-journal-result',
                });
            }
        });
    }

    acceptExecutionJournalResult(computerId: string, result: AgentExecutionJournalResult): boolean {
        const pending = this.pendingExecutionJournalRequests.get(result.requestId);
        if (
            !pending ||
            pending.computerId !== computerId ||
            pending.agentId !== result.agentId ||
            pending.runId !== result.runId ||
            this.attached.get(computerId)?.serverId !== pending.serverId
        ) {
            return false;
        }
        clearTimeout(pending.timeout);
        this.pendingExecutionJournalRequests.delete(result.requestId);
        pending.resolve(result);
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
