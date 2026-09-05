import { agentRouter } from './agent/router.ts';
import { askRouter } from './ask/router.ts';
import { attachmentRouter } from './attachment/router.ts';
import { automationRouter } from './automation/router.ts';
import { avatarRouter } from './avatar/router.ts';
import { browserRouter } from './browser/router.ts';
import { chatRouter } from './chat/router.ts';
import { computerRouter } from './computer/router.ts';
import { devRouter } from './dev/router.ts';
import { invitationRouter } from './invitation/router.ts';
import { mcpRouter } from './mcp/router.ts';
import { memberRouter } from './member/router.ts';
import { preparedActionRouter } from './prepared-action/router.ts';
import { reminderRouter } from './reminder/router.ts';
import { serverRouter } from './server/router.ts';
import { statsRouter } from './stats/router.ts';
import { taskRouter } from './task/router.ts';
import { taskLabelRouter } from './task-label/router.ts';
import { threadRouter } from './thread/router.ts';
import { triggerRouter } from './trigger/router.ts';
import { createRouter } from './trpc.ts';

/**
 * The whole Grotto Server contract.
 */
export const grottoRouter = createRouter({
    agent: agentRouter,
    ask: askRouter,
    attachment: attachmentRouter,
    automation: automationRouter,
    avatar: avatarRouter,
    browser: browserRouter,
    chat: chatRouter,
    computer: computerRouter,
    dev: devRouter,
    invitation: invitationRouter,
    member: memberRouter,
    mcp: mcpRouter,
    preparedAction: preparedActionRouter,
    reminder: reminderRouter,
    server: serverRouter,
    stats: statsRouter,
    task: taskRouter,
    taskLabel: taskLabelRouter,
    thread: threadRouter,
    trigger: triggerRouter,
});

export type GrottoRouter = typeof grottoRouter;
