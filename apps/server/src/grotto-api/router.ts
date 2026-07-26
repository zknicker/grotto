import { chatRouter } from './chat/router.ts';
import { serverRouter } from './server/router.ts';
import { threadRouter } from './thread/router.ts';
import { createRouter } from './trpc.ts';

/**
 * The whole hosted Grotto Server contract. Pre-WS6 local-owner procedures stay
 * on the local sidecar's router and are not reachable here.
 */
export const grottoRouter = createRouter({
    chat: chatRouter,
    server: serverRouter,
    thread: threadRouter,
});

export type GrottoRouter = typeof grottoRouter;
