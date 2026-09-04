import { createRouter } from '../trpc.ts';
import { createTriggerProcedure } from './create.ts';
import { deleteTriggerProcedure } from './delete.ts';
import { listTriggersProcedure } from './list.ts';
import { rotateTriggerProcedure } from './rotate.ts';
import { listTriggerRunsProcedure } from './runs.ts';
import { setTriggerStatusProcedure } from './set-status.ts';
import { testTriggerProcedure } from './test-fire.ts';
import { updateTriggerProcedure } from './update.ts';

export const triggerRouter = createRouter({
    create: createTriggerProcedure,
    delete: deleteTriggerProcedure,
    list: listTriggersProcedure,
    rotate: rotateTriggerProcedure,
    runs: listTriggerRunsProcedure,
    setStatus: setTriggerStatusProcedure,
    test: testTriggerProcedure,
    update: updateTriggerProcedure,
});
