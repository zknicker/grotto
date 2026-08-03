import { hostedAvatarSchema, hostedSetAvatarInputSchema } from '@tavern/api';
import { setHostedAvatar } from '../../avatars/set-avatar.ts';
import { avatarProcedure } from './procedure.ts';

export const setAvatarProcedure = avatarProcedure
    .input(hostedSetAvatarInputSchema)
    .output(hostedAvatarSchema)
    .mutation(async ({ ctx, input }) => await setHostedAvatar(ctx.grottoDb, ctx.member, input));
