import type {
    AgentCommand,
    AgentExecutionJournalResult,
    AgentSkillFileRequest,
    AgentSkillFileResult,
    AgentSkillImportResult,
    AgentWorkspaceRequest,
    AgentWorkspaceResult,
} from '@grotto/api';
import { type EffectRuntime, settle } from '@grotto/effect';
import { Deferred, Effect } from 'effect';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import {
    type AgentReply,
    type ExecutionJournalReply,
    type SkillFileReply,
    type SkillFileValue,
    type SkillImportReply,
    unavailableJournal,
    type WorkspaceReply,
    type WorkspaceValue,
} from './agent-reply-model.ts';

interface AgentReplyOfficeOptions {
    runtime: EffectRuntime<never>;
    send(computerId: string, frame: AgentCommand): boolean;
    timeoutMs?: number;
}
export class AgentReplyOffice {
    private readonly pending = new Map<string, AgentReply>();
    constructor(private readonly options: AgentReplyOfficeOptions) {}
    requestSkillImport(
        computerId: string,
        input: { agentId: string; sourceId: string }
    ): Promise<{ requestId: string; status: 'accepted' }> {
        const reply: SkillImportReply = {
            ...input,
            computerId,
            deferred: this.options.runtime.runSync(Deferred.make()),
            kind: 'skill-import',
            requestId: createOpaqueId('req'),
        };
        return this.start(reply, {
            ...input,
            requestId: reply.requestId,
            type: 'agent-skill-import',
        });
    }
    requestSkillFile(
        computerId: string,
        input: { agentId: string; operation: AgentSkillFileRequest['operation'] }
    ): Promise<SkillFileValue> {
        const reply: SkillFileReply = {
            agentId: input.agentId,
            computerId,
            deferred: this.options.runtime.runSync(Deferred.make()),
            kind: 'skill-file',
            requestId: createOpaqueId('req'),
        };
        return this.start(
            reply,
            {
                ...input,
                requestId: reply.requestId,
                type: 'agent-skill-file-request',
            },
            () => new Error('The Computer did not answer the skill request.')
        );
    }
    requestWorkspace(
        computerId: string,
        input: { agentId: string; operation: AgentWorkspaceRequest['operation'] }
    ): Promise<WorkspaceValue> {
        const reply: WorkspaceReply = {
            agentId: input.agentId,
            computerId,
            deferred: this.options.runtime.runSync(Deferred.make()),
            kind: 'workspace',
            requestId: createOpaqueId('req'),
        };
        return this.start(
            reply,
            {
                ...input,
                requestId: reply.requestId,
                type: 'agent-workspace-request',
            },
            () => new Error('The Computer did not answer the workspace request.')
        );
    }
    requestExecutionJournal(
        computerId: string,
        input: { agentId: string; runId: string; serverId: string }
    ): Promise<AgentExecutionJournalResult> {
        const reply: ExecutionJournalReply = {
            ...input,
            computerId,
            deferred: this.options.runtime.runSync(Deferred.make()),
            kind: 'execution-journal',
            requestId: createOpaqueId('req'),
        };
        return this.start(
            reply,
            {
                agentId: input.agentId,
                requestId: reply.requestId,
                runId: input.runId,
                type: 'agent-execution-journal-request',
            },
            () => unavailableJournal(reply, 'timeout')
        );
    }
    acceptSkillImport(computerId: string, result: AgentSkillImportResult): boolean {
        const reply = this.pending.get(result.requestId);
        if (
            !this.matches(reply, 'skill-import', computerId, result.agentId) ||
            reply.sourceId !== result.sourceId
        ) {
            return false;
        }
        if (result.status === 'accepted' || result.status === 'applied') {
            return this.resolve(reply, reply.deferred, {
                requestId: result.requestId,
                status: 'accepted',
            });
        }
        return this.reject(reply, new Error(result.error));
    }
    acceptSkillFile(computerId: string, result: AgentSkillFileResult): boolean {
        const reply = this.pending.get(result.requestId);
        if (!this.matches(reply, 'skill-file', computerId, result.agentId)) {
            return false;
        }
        if (result.result) {
            return this.resolve(reply, reply.deferred, result.result);
        }
        return this.reject(reply, new Error(result.error ?? 'The Agent skill request failed.'));
    }
    acceptWorkspace(computerId: string, result: AgentWorkspaceResult): boolean {
        const reply = this.pending.get(result.requestId);
        if (!this.matches(reply, 'workspace', computerId, result.agentId)) {
            return false;
        }
        if (result.result) {
            return this.resolve(reply, reply.deferred, result.result);
        }
        return this.reject(reply, new Error(result.error ?? 'The workspace request failed.'));
    }
    acceptExecutionJournal(
        computerId: string,
        attachedServerId: string | undefined,
        result: AgentExecutionJournalResult
    ): boolean {
        const reply = this.pending.get(result.requestId);
        if (
            !this.matches(reply, 'execution-journal', computerId, result.agentId) ||
            reply.runId !== result.runId ||
            reply.serverId !== attachedServerId
        ) {
            return false;
        }
        return this.resolve(reply, reply.deferred, result);
    }
    disconnect(computerId: string): void {
        for (const reply of this.pending.values()) {
            if (reply.computerId !== computerId) {
                continue;
            }
            if (reply.kind === 'execution-journal') {
                this.resolve(reply, reply.deferred, unavailableJournal(reply, 'offline'));
            } else {
                this.reject(reply, new Error('The selected Computer went offline.'));
            }
        }
    }
    private await<A>(
        reply: AgentReply,
        deferred: Deferred.Deferred<A, Error>,
        onTimeout?: () => A | Error
    ): Promise<A> {
        const timeout = onTimeout
            ? Effect.sleep(this.options.timeoutMs ?? 10_000).pipe(
                  Effect.andThen(
                      Effect.suspend(() => {
                          const outcome = onTimeout();
                          return outcome instanceof Error
                              ? Effect.fail(outcome)
                              : Effect.succeed(outcome);
                      })
                  )
              )
            : Effect.never;
        return settle(
            this.options.runtime,
            Effect.raceFirst(Deferred.await(deferred), timeout).pipe(
                Effect.ensuring(Effect.sync(() => this.take(reply)))
            )
        );
    }
    private take(reply: AgentReply): boolean {
        if (this.pending.get(reply.requestId) === reply) {
            this.pending.delete(reply.requestId);
            return true;
        }
        return false;
    }
    private matches<K extends AgentReply['kind']>(
        reply: AgentReply | undefined,
        kind: K,
        computerId: string,
        agentId: string
    ): reply is Extract<AgentReply, { kind: K }> {
        return reply?.kind === kind && reply.computerId === computerId && reply.agentId === agentId;
    }
    private start<A>(
        reply: AgentReply & {
            deferred: Deferred.Deferred<A, Error>;
        },
        frame: AgentCommand,
        onTimeout?: () => A | Error
    ): Promise<A> {
        this.pending.set(reply.requestId, reply);
        if (reply.kind === 'execution-journal') {
            this.sendOrUnavailable(reply, frame);
        } else {
            this.sendOrFail(reply, frame);
        }
        return this.await(reply, reply.deferred, onTimeout);
    }
    private sendOrFail(
        reply: Exclude<AgentReply, ExecutionJournalReply>,
        frame: AgentCommand
    ): void {
        try {
            if (!this.options.send(reply.computerId, frame)) {
                this.reject(reply, new Error('The selected Computer is offline.'));
            }
        } catch (cause) {
            this.reject(reply, asError(cause));
        }
    }
    private sendOrUnavailable(reply: ExecutionJournalReply, frame: AgentCommand): void {
        try {
            if (this.options.send(reply.computerId, frame)) {
                return;
            }
        } catch {}
        this.resolve(reply, reply.deferred, unavailableJournal(reply, 'offline'));
    }
    private reject(reply: Exclude<AgentReply, ExecutionJournalReply>, error: Error): boolean {
        if (!this.take(reply)) {
            return false;
        }
        switch (reply.kind) {
            case 'skill-file':
                this.options.runtime.runSync(Deferred.fail(reply.deferred, error));
                break;
            case 'skill-import':
                this.options.runtime.runSync(Deferred.fail(reply.deferred, error));
                break;
            case 'workspace':
                this.options.runtime.runSync(Deferred.fail(reply.deferred, error));
                break;
        }
        return true;
    }
    private resolve<A, Error>(
        reply: AgentReply,
        deferred: Deferred.Deferred<A, Error>,
        value: NoInfer<A>
    ): boolean {
        if (!this.take(reply)) {
            return false;
        }
        this.options.runtime.runSync(Deferred.succeed(deferred, value));
        return true;
    }
}
function asError(cause: unknown): Error {
    return cause instanceof Error ? cause : new Error(String(cause));
}
