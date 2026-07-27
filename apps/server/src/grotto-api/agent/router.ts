import { createRouter } from '../trpc.ts';
import { configureAgentProcedure } from './configure.ts';
import { createAgentProcedure } from './create.ts';
import { agentDeliveryStateProcedure } from './delivery-state.ts';
import { listAgentsProcedure } from './list.ts';
import { startAgentProcedure } from './start.ts';
import { stopAgentProcedure } from './stop.ts';

export const agentRouter = createRouter({
    configure: configureAgentProcedure,
    create: createAgentProcedure,
    deliveryState: agentDeliveryStateProcedure,
    list: listAgentsProcedure,
    start: startAgentProcedure,
    stop: stopAgentProcedure,
});
