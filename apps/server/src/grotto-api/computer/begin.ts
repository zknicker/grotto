import { beginComputerSetupSchema } from '../../computers/contracts.ts';
import { beginComputerSetup } from '../../computers/service.ts';
import { computerProcedure } from '../trpc.ts';

export const beginComputerSetupProcedure = computerProcedure
    .input(beginComputerSetupSchema)
    .mutation(async ({ ctx, input }) => {
        const setup = await beginComputerSetup(ctx.grottoDb, input);
        const approvalUrl = new URL('/computer/approve', ctx.appOrigin);
        approvalUrl.searchParams.set('approval', setup.approvalId);
        approvalUrl.searchParams.set('secret', setup.secret);
        return { approvalUrl: approvalUrl.toString(), serverId: setup.serverId };
    });
