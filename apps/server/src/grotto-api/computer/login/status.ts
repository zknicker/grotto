import { computerLoginStatusSchema } from '../../../computers/contracts.ts';
import { readComputerLoginStatus } from '../../../computers/login-service.ts';
import { publicProcedure } from '../../trpc.ts';

export const computerLoginStatusProcedure = publicProcedure
    .input(computerLoginStatusSchema)
    .query(async ({ ctx, input }) => readComputerLoginStatus(ctx.grottoDb, input));
