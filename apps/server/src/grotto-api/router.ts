import { chatRouter } from './chat/router.ts';
import { invitationRouter } from './invitation/router.ts';
import { memberRouter } from './member/router.ts';
import { serverRouter } from './server/router.ts';
import { taskRouter } from './task/router.ts';
import { taskLabelRouter } from './task-label/router.ts';
import { threadRouter } from './thread/router.ts';
import { createRouter } from './trpc.ts';

/**
 * The whole hosted Grotto Server contract. Pre-WS6 local-owner procedures stay
 * on the local sidecar's router and are not reachable here.
 */
export const grottoRouter = createRouter({
    chat: chatRouter,
    invitation: invitationRouter,
    member: memberRouter,
    server: serverRouter,
    task: taskRouter,
    taskLabel: taskLabelRouter,
    thread: threadRouter,
});

export type GrottoRouter = typeof grottoRouter;
