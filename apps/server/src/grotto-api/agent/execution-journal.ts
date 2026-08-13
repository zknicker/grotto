import {
    hostedAgentExecutionJournalInputSchema,
    hostedAgentExecutionJournalResultSchema,
} from '@tavern/api';
import { TRPCError } from '@trpc/server';
import {
    AgentExecutionJournalAccessError,
    requestHostedAgentExecutionJournal,
} from '../../hosted-agents/agent-execution-journal.ts';
import { memberProcedure } from '../server/procedure.ts';

export const agentExecutionJournalProcedure = memberProcedure
    .input(hostedAgentExecutionJournalInputSchema)
    .output(hostedAgentExecutionJournalResultSchema)
    .query(async ({ ctx, input }) => {
        try {
            return await requestHostedAgentExecutionJournal(
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
