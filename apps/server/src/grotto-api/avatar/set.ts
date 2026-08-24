import { avatarSchema, setAvatarInputSchema } from '@grotto/api';
import { setAvatar } from '../../avatars/set-avatar.ts';
import { avatarProcedure } from './procedure.ts';

export const setAvatarProcedure = avatarProcedure
    .input(setAvatarInputSchema)
    .output(avatarSchema)
    .mutation(async ({ ctx, input }) => await setAvatar(ctx.grottoDb, ctx.member, input));
