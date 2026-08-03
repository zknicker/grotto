import { hostedAvatarSchema, hostedClearAvatarInputSchema } from '@tavern/api';
import { clearHostedAvatar } from '../../avatars/set-avatar.ts';
import { avatarProcedure } from './procedure.ts';

export const clearAvatarProcedure = avatarProcedure
    .input(hostedClearAvatarInputSchema)
    .output(hostedAvatarSchema)
    .mutation(async ({ ctx, input }) => await clearHostedAvatar(ctx.grottoDb, ctx.member, input));
