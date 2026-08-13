import { agentExecutionJournalInputSchema, agentExecutionJournalResultSchema } from '@tavern/api';
import { TRPCError } from '@trpc/server';
import {
    AgentExecutionJournalAccessError,
    requestAgentExecutionJournal,
} from '../../server-agents/agent-execution-journal.ts';
import { memberProcedure } from '../server/procedure.ts';

export const agentExecutionJournalProcedure = memberProcedure
    .input(agentExecutionJournalInputSchema)
    .output(agentExecutionJournalResultSchema)
    .query(async ({ ctx, input }) => {
        try {
            return await requestAgentExecutionJournal(
                ctx.grottoDb,
                ctx.computerConnections,
                ctx.member,
                input
            );
        } catch (cause) {
            if (cause instanceof AgentExecutionJournalAccessError) {
                throw new TRPCError({ cause, code: 'FORBIDDEN', message: cause.message });
            }
            throw cause;
        }
    });
