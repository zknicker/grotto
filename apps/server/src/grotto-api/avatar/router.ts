import { createRouter } from '../trpc.ts';
import { clearAvatarProcedure } from './clear.ts';
import { generateAvatarProcedure } from './generate.ts';
import { setAvatarProcedure } from './set.ts';

export const avatarRouter = createRouter({
    clear: clearAvatarProcedure,
    generate: generateAvatarProcedure,
    set: setAvatarProcedure,
});
