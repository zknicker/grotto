import { createRouter } from '../trpc.ts';
import { approveComputerSetupProcedure } from './approve.ts';
import { beginComputerSetupProcedure } from './begin.ts';
import { listComputersProcedure } from './list.ts';
import { removeComputerProcedure } from './remove.ts';
import { computerSetupStatusProcedure } from './status.ts';
import { validateComputerProcedure } from './validate.ts';

export const computerRouter = createRouter({
    approve: approveComputerSetupProcedure,
    begin: beginComputerSetupProcedure,
    list: listComputersProcedure,
    remove: removeComputerProcedure,
    status: computerSetupStatusProcedure,
    validate: validateComputerProcedure,
});
