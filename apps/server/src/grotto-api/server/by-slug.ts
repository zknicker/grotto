import { z } from 'zod';
import { serverSlugSchema } from '../../servers/contracts.ts';
import { openServerBySlug } from '../../servers/server-access.ts';
import { memberProcedure } from './procedure.ts';

export const serverBySlugProcedure = memberProcedure
    .input(z.object({ slug: serverSlugSchema }).strict())
    .query(async ({ ctx, input }) => await openServerBySlug(ctx.grottoDb, ctx.member, input.slug));
