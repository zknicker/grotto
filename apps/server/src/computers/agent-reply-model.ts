import type {
    AgentExecutionJournalResult,
    AgentSkillFileResult,
    AgentWorkspaceResult,
} from '@grotto/api';
import type { Deferred } from 'effect';

export type SkillFileValue = NonNullable<AgentSkillFileResult['result']>;
export type WorkspaceValue = NonNullable<AgentWorkspaceResult['result']>;

interface ReplyIdentity {
    agentId: string;
    computerId: string;
    requestId: string;
}

export interface SkillImportReply extends ReplyIdentity {
    deferred: Deferred.Deferred<{ requestId: string; status: 'accepted' }, Error>;
    kind: 'skill-import';
    sourceId: string;
}

export interface SkillFileReply extends ReplyIdentity {
    deferred: Deferred.Deferred<SkillFileValue, Error>;
    kind: 'skill-file';
}

export interface WorkspaceReply extends ReplyIdentity {
    deferred: Deferred.Deferred<WorkspaceValue, Error>;
    kind: 'workspace';
}

export interface ExecutionJournalReply extends ReplyIdentity {
    deferred: Deferred.Deferred<AgentExecutionJournalResult, Error>;
    kind: 'execution-journal';
    runId: string;
    serverId: string;
}

export type AgentReply = SkillImportReply | SkillFileReply | WorkspaceReply | ExecutionJournalReply;

export function unavailableJournal(
    reply: Pick<ExecutionJournalReply, 'agentId' | 'requestId' | 'runId'>,
    reason: 'offline' | 'timeout'
): AgentExecutionJournalResult {
    return {
        agentId: reply.agentId,
        reason,
        requestId: reply.requestId,
        runId: reply.runId,
        status: 'unavailable',
        type: 'agent-execution-journal-result',
    };
}
