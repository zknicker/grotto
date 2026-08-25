import { avatarSchema, clearAvatarInputSchema } from '@grotto/api';
import { clearAvatar } from '../../avatars/set-avatar.ts';
import { avatarProcedure } from './procedure.ts';

export const clearAvatarProcedure = avatarProcedure
    .input(clearAvatarInputSchema)
    .output(avatarSchema)
    .mutation(async ({ ctx, input }) => await clearAvatar(ctx.grottoDb, ctx.member, input));
