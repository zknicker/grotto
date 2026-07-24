import { agentRuntimeSaveBrowserSettingsSchema } from '@tavern/api';
import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const saveBrowserSettingsProcedure = publicProcedure
    .input(agentRuntimeSaveBrowserSettingsSchema)
    .mutation(async ({ input }) => {
        const client = createConfiguredAgentRuntimeClient();
        if (!client) {
            throw new Error('Grotto Runtime is not connected.');
        }

        try {
            return await client.saveBrowserSettings(input);
        } finally {
            client.close();
        }
    });
