import { createRouter } from '../trpc.ts';
import { cleanupEvalChatsRoute } from './cleanup-eval-chats.ts';
import { createClerkSignInTokenRoute } from './create-clerk-sign-in-token.ts';

export const devRouter = createRouter({
    cleanupEvalChats: cleanupEvalChatsRoute,
    createClerkSignInToken: createClerkSignInTokenRoute,
});
