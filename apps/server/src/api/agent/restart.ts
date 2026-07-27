import { z } from 'zod';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

// Restart lifecycle action (specs/sessions.md): resume the current session
// unchanged. Unlike a reset it rotates neither the session nor the agent token
// and lands no receipt; it interrupts any live turn and re-drives the current
// session.
export const restartAgentRoute = publicProcedure
    .input(z.object({ agentId: z.string().trim().min(1) }))
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Grotto Runtime is not connected.');
        }
        try {
            return await client.restartAgent(input.agentId);
        } finally {
            client.close();
        }
    });
