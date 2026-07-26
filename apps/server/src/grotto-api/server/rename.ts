import { z } from 'zod';
import { serverDisplayNameSchema, serverIdSchema } from '../../servers/contracts.ts';
import { renameServer } from '../../servers/rename-server.ts';
import { emitServerUpdated } from '../server-events.ts';
import { memberProcedure } from './procedure.ts';

export const renameServerProcedure = memberProcedure
    .input(z.object({ displayName: serverDisplayNameSchema, serverId: serverIdSchema }).strict())
    .mutation(async ({ ctx, input }) => {
        const server = await renameServer(ctx.grottoDb, ctx.member, input);

        emitServerUpdated({ serverId: server.id });
        return server;
    });
