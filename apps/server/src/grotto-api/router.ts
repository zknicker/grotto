import { agentRouter } from './agent/router.ts';
import { attachmentRouter } from './attachment/router.ts';
import { chatRouter } from './chat/router.ts';
import { computerRouter } from './computer/router.ts';
import { invitationRouter } from './invitation/router.ts';
import { mcpRouter } from './mcp/router.ts';
import { memberRouter } from './member/router.ts';
import { reminderRouter } from './reminder/router.ts';
import { serverRouter } from './server/router.ts';
import { taskRouter } from './task/router.ts';
import { taskLabelRouter } from './task-label/router.ts';
import { threadRouter } from './thread/router.ts';
import { createRouter } from './trpc.ts';

/**
 * The whole hosted Grotto Server contract.
 */
export const grottoRouter = createRouter({
    agent: agentRouter,
    attachment: attachmentRouter,
    chat: chatRouter,
    computer: computerRouter,
    invitation: invitationRouter,
    member: memberRouter,
    mcp: mcpRouter,
    reminder: reminderRouter,
    server: serverRouter,
    task: taskRouter,
    taskLabel: taskLabelRouter,
    thread: threadRouter,
});

export type GrottoRouter = typeof grottoRouter;
