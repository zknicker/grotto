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
} from '@grotto/api';
import type { EffectRuntime } from '@grotto/effect';
import type { DeliveryTransport } from '../agent-delivery/delivery.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { AgentReplyOffice } from './agent-reply-office.ts';
import { BrowserReplyOffice } from './browser-reply-office.ts';

interface AttachedComputer {
    disconnect?(reason: string): void;
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
    private readonly agentReplies: AgentReplyOffice;
    private readonly browserReplies: BrowserReplyOffice;

    constructor(runtime: EffectRuntime<never>) {
        this.agentReplies = new AgentReplyOffice({
            runtime,
            send: (computerId, frame) => this.send(computerId, frame),
        });
        this.browserReplies = new BrowserReplyOffice({
            runtime,
            send: (computerId, frame) => this.send(computerId, frame),
        });
    }

    register(computerId: string, computer: AttachedComputer): void {
        this.attached.set(computerId, computer);
    }

    unregister(computerId: string): void {
        this.attached.delete(computerId);
        this.agentReplies.disconnect(computerId);
        this.browserReplies.disconnect(computerId);
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
        return this.agentReplies.requestSkillImport(computerId, input);
    }

    acceptSkillImport(computerId: string, result: AgentSkillImportResult): boolean {
        return this.agentReplies.acceptSkillImport(computerId, result);
    }

    requestSkillFile(
        computerId: string,
        input: {
            agentId: string;
            operation: AgentSkillFileRequest['operation'];
        }
    ): Promise<NonNullable<AgentSkillFileResult['result']>> {
        return this.agentReplies.requestSkillFile(computerId, input);
    }

    acceptSkillFileResult(computerId: string, result: AgentSkillFileResult): boolean {
        return this.agentReplies.acceptSkillFile(computerId, result);
    }

    requestWorkspace(
        computerId: string,
        input: {
            agentId: string;
            operation: AgentWorkspaceRequest['operation'];
        }
    ): Promise<NonNullable<AgentWorkspaceResult['result']>> {
        return this.agentReplies.requestWorkspace(computerId, input);
    }

    acceptWorkspaceResult(computerId: string, result: AgentWorkspaceResult): boolean {
        return this.agentReplies.acceptWorkspace(computerId, result);
    }

    requestBrowser(
        computerId: string,
        operation: BrowserRequest['operation']
    ): Promise<NonNullable<BrowserResult['result']>> {
        return this.browserReplies.request(computerId, operation);
    }

    acceptBrowserResult(computerId: string, result: BrowserResult): boolean {
        return this.browserReplies.accept(computerId, result);
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
        return this.agentReplies.requestExecutionJournal(computerId, input);
    }

    acceptExecutionJournalResult(computerId: string, result: AgentExecutionJournalResult): boolean {
        return this.agentReplies.acceptExecutionJournal(
            computerId,
            this.attached.get(computerId)?.serverId,
            result
        );
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
