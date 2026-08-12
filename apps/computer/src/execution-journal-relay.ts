import { join } from 'node:path';
import type {
    HostedAgentExecutionJournalRequest,
    HostedAgentExecutionJournalResult,
} from '@tavern/api';
import { hostedAgentExecutionJournalRequestSchema } from '@tavern/api';
import {
    type ComputerExecutionJournalDocument,
    isExecutionJournalRunId,
    readComputerExecutionJournal,
} from './harness/execution-journal.ts';

export function parseExecutionJournalRequest(
    frame: unknown
): HostedAgentExecutionJournalRequest | null {
    const parsed = hostedAgentExecutionJournalRequestSchema.safeParse(frame);
    return parsed.success ? parsed.data : null;
}

export async function readExecutionJournalRequest(input: {
    dataRoot: string;
    request: HostedAgentExecutionJournalRequest;
    serverId: string;
}): Promise<HostedAgentExecutionJournalResult> {
    if (!isExecutionJournalRunId(input.request.runId)) {
        return unavailableResult(input.request, 'missing');
    }
    const agentRoot = join(
        input.dataRoot,
        'servers',
        input.serverId,
        'agents',
        input.request.agentId
    );
    const journal = await readComputerExecutionJournal(agentRoot, input.request.runId);
    return journal
        ? {
              agentId: input.request.agentId,
              journal: journal as ComputerExecutionJournalDocument,
              requestId: input.request.requestId,
              runId: input.request.runId,
              status: 'available',
              type: 'agent-execution-journal-result',
          }
        : unavailableResult(input.request, 'missing');
}

function unavailableResult(
    request: HostedAgentExecutionJournalRequest,
    reason: 'missing'
): HostedAgentExecutionJournalResult {
    return {
        agentId: request.agentId,
        reason,
        requestId: request.requestId,
        runId: request.runId,
        status: 'unavailable',
        type: 'agent-execution-journal-result',
    };
}
