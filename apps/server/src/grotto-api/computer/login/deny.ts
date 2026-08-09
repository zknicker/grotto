import { denyComputerLoginSchema } from '../../../computers/contracts.ts';
import { denyComputerLogin } from '../../../computers/login-service.ts';
import { humanProcedure } from '../../trpc.ts';
import { throwComputerLoginTrpcError } from './approve.ts';

export const denyComputerLoginProcedure = humanProcedure
    .input(denyComputerLoginSchema)
    .mutation(async ({ ctx, input }) => {
        try {
            return await denyComputerLogin(ctx.grottoDb, ctx.clerkUserId, input);
        } catch (cause) {
            throwComputerLoginTrpcError(cause);
        }
    });
