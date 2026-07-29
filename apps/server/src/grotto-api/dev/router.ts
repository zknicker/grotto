import { createRouter } from '../trpc.ts';
import { createClerkSignInTokenRoute } from './create-clerk-sign-in-token.ts';

export const devRouter = createRouter({
    createClerkSignInToken: createClerkSignInTokenRoute,
});
