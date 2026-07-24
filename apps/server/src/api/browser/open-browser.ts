import { createConfiguredAgentRuntimeClient } from '../../agent-runtime/configured-client.ts';
import { publicProcedure } from '../trpc.ts';

export const openBrowserProcedure = publicProcedure.mutation(async () => {
    const client = createConfiguredAgentRuntimeClient();
    if (!client) {
        throw new Error('Grotto Runtime is not connected.');
    }

    try {
        return await client.openBrowser();
    } finally {
        client.close();
    }
});
