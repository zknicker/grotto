import { createRouter } from '../trpc.ts';
import { serverBySlugProcedure } from './by-slug.ts';
import { createServerProcedure } from './create.ts';
import { deleteServerProcedure, serverDeletionStatusProcedure } from './delete.ts';
import { listServersProcedure } from './list.ts';
import { onServerUpdate } from './on-update.ts';
import { renameServerProcedure } from './rename.ts';

export const serverRouter = createRouter({
    bySlug: serverBySlugProcedure,
    create: createServerProcedure,
    delete: deleteServerProcedure,
    deletionStatus: serverDeletionStatusProcedure,
    list: listServersProcedure,
    onUpdate: onServerUpdate,
    rename: renameServerProcedure,
});
