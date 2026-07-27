import { createRouter } from '../trpc.ts';
import { approveComputerSetupProcedure } from './approve.ts';
import { beginComputerSetupProcedure } from './begin.ts';
import { checkComputerUpdateProcedure } from './check-update.ts';
import { listComputersProcedure } from './list.ts';
import { startComputerUpdateProcedure } from './start-update.ts';
import { computerSetupStatusProcedure } from './status.ts';
import { validateComputerProcedure } from './validate.ts';

export const computerRouter = createRouter({
    approve: approveComputerSetupProcedure,
    begin: beginComputerSetupProcedure,
    checkUpdate: checkComputerUpdateProcedure,
    list: listComputersProcedure,
    status: computerSetupStatusProcedure,
    update: startComputerUpdateProcedure,
    validate: validateComputerProcedure,
});
