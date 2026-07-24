import { agentRouter } from './agent/router.ts';
import { agentRuntimeRouter } from './agent-runtime/router.ts';
import { browserRouter } from './browser/router.ts';
import { chatRouter } from './chat/router.ts';
import { devRouter } from './dev/router.ts';
import { identityRouter } from './identity/router.ts';
import { jobsRouter } from './jobs/router.ts';
import { labelRouter } from './label/router.ts';
import { logRouter } from './log/router.ts';
import { mcpRouter } from './mcp/router.ts';
import { mentionRouter } from './mention/router.ts';
import { messagingPlatformRouter } from './messaging-platform/router.ts';
import { modelRouter } from './model/router.ts';
import { modelAccessRouter } from './model-access/router.ts';
import { openAiSettingsRouter } from './openai-settings/router.ts';
import { openRouterSettingsRouter } from './openrouter-settings/router.ts';
import { paneRouter } from './pane/router.ts';
import { participantRouter } from './participant/router.ts';
import { reminderRouter } from './reminder/router.ts';
import { sessionRouter } from './session/router.ts';
import { skillRouter } from './skill/router.ts';
import { subAgentRouter } from './sub-agent/router.ts';
import { taskRouter } from './task/router.ts';
import { threadRouter } from './thread/router.ts';
import { timezoneRouter } from './timezone/router.ts';
import { createRouter } from './trpc.ts';
import { usageRouter } from './usage/router.ts';
import { workerRouter } from './worker/router.ts';

export const appRouter = createRouter({
    agent: agentRouter,
    browser: browserRouter,
    identity: identityRouter,
    chat: chatRouter,
    mcp: mcpRouter,
    dev: devRouter,
    jobs: jobsRouter,
    label: labelRouter,
    log: logRouter,
    mention: mentionRouter,
    messagingPlatform: messagingPlatformRouter,
    modelAccess: modelAccessRouter,
    model: modelRouter,
    openAiSettings: openAiSettingsRouter,
    openRouterSettings: openRouterSettingsRouter,
    pane: paneRouter,
    participant: participantRouter,
    reminder: reminderRouter,
    agentRuntime: agentRuntimeRouter,
    session: sessionRouter,
    skill: skillRouter,
    subAgent: subAgentRouter,
    thread: threadRouter,
    task: taskRouter,
    timezone: timezoneRouter,
    usage: usageRouter,
    worker: workerRouter,
});

export type AppRouter = typeof appRouter;
