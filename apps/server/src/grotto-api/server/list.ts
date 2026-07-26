import { listAccessibleServers } from '../../servers/accessible-servers.ts';
import { memberProcedure } from './procedure.ts';

export const listServersProcedure = memberProcedure.query(async ({ ctx }) =>
    ctx.member ? await listAccessibleServers(ctx.grottoDb, ctx.member.id) : []
);
