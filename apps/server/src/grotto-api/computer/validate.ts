import { validateComputerCredentialSchema } from '../../computers/contracts.ts';
import { validateComputerCredential } from '../../computers/service.ts';
import { computerProcedure } from '../trpc.ts';

export const validateComputerProcedure = computerProcedure
    .input(validateComputerCredentialSchema)
    .query(async ({ ctx, input }) => await validateComputerCredential(ctx.grottoDb, input));
