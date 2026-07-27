import { computerSetupStatusSchema } from '../../computers/contracts.ts';
import { readComputerSetupStatus } from '../../computers/service.ts';
import { computerProcedure } from '../trpc.ts';

export const computerSetupStatusProcedure = computerProcedure
    .input(computerSetupStatusSchema)
    .query(async ({ ctx, input }) => await readComputerSetupStatus(ctx.grottoDb, input));
