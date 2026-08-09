import { createRouter } from '../../trpc.ts';
import { approveComputerLoginProcedure } from './approve.ts';
import { denyComputerLoginProcedure } from './deny.ts';
import { computerLoginStatusProcedure } from './status.ts';

export const computerLoginRouter = createRouter({
    approve: approveComputerLoginProcedure,
    deny: denyComputerLoginProcedure,
    status: computerLoginStatusProcedure,
});
