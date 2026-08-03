import { createRouter } from '../trpc.ts';
import { clearAvatarProcedure } from './clear.ts';
import { setAvatarProcedure } from './set.ts';

export const avatarRouter = createRouter({
    clear: clearAvatarProcedure,
    set: setAvatarProcedure,
});
