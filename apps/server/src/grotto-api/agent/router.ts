import { createRouter } from '../trpc.ts';
import { configureAgentProcedure } from './configure.ts';
import { createAgentProcedure } from './create.ts';
import { listAgentsProcedure } from './list.ts';

export const agentRouter = createRouter({
    configure: configureAgentProcedure,
    create: createAgentProcedure,
    list: listAgentsProcedure,
});
