import type { AgentSkillFileRequest, AgentSkillFileResult } from '@grotto/api';
import { createOpaqueId } from '../postgres/opaque-id.ts';

interface PendingSkillFileRequest {
    agentId: string;
    computerId: string;
    reject(error: Error): void;
    resolve(result: NonNullable<AgentSkillFileResult['result']>): void;
    timeout: ReturnType<typeof setTimeout>;
}

export class SkillFileRelay {
    private readonly pending = new Map<string, PendingSkillFileRequest>();

    constructor(
        private readonly send: (computerId: string, frame: AgentSkillFileRequest) => boolean
    ) {}

    request(
        computerId: string,
        input: {
            agentId: string;
            operation: AgentSkillFileRequest['operation'];
        }
    ): Promise<NonNullable<AgentSkillFileResult['result']>> {
        const requestId = createOpaqueId('req');
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(requestId);
                reject(new Error('The Computer did not answer the skill request.'));
            }, 10_000);
            this.pending.set(requestId, {
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
                    type: 'agent-skill-file-request',
                })
            ) {
                clearTimeout(timeout);
                this.pending.delete(requestId);
                reject(new Error('The selected Computer is offline.'));
            }
        });
    }

    accept(computerId: string, result: AgentSkillFileResult): boolean {
        const pending = this.pending.get(result.requestId);
        if (!pending || pending.computerId !== computerId || pending.agentId !== result.agentId) {
            return false;
        }
        clearTimeout(pending.timeout);
        this.pending.delete(result.requestId);
        if (result.result) {
            pending.resolve(result.result);
        } else {
            pending.reject(new Error(result.error ?? 'The Agent skill request failed.'));
        }
        return true;
    }

    disconnect(computerId: string): void {
        for (const [requestId, pending] of this.pending) {
            if (pending.computerId === computerId) {
                clearTimeout(pending.timeout);
                this.pending.delete(requestId);
                pending.reject(new Error('The selected Computer went offline.'));
            }
        }
    }
}
