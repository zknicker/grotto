import { ZodError } from 'zod';
import { AgentApiError } from './agent-api-errors.ts';
import {
    agentAttachmentUploadRequestSchema,
    uploadAgentAttachment,
    viewAgentAttachment,
} from './agent-attachments.ts';
import {
    agentChannelActionRequestSchema,
    joinAgentChannel,
    leaveAgentChannel,
    muteAgentChannel,
    unmuteAgentChannel,
} from './agent-channels.ts';
import {
    readAgentChannelInfo,
    readAgentChannelMembers,
    readAgentServerInfo,
} from './agent-directory.ts';
import { readAgentDraft } from './agent-drafts.ts';
import { getAgentMessage, readAgentHistory, searchAgentMessages } from './agent-history.ts';
import { checkAgentInbox, checkAgentMessages } from './agent-inbox-api.ts';
import {
    agentProfileUpdateRequestSchema,
    readAgentProfile,
    updateAgentProfile,
} from './agent-profile.ts';
import { agentReactionRequestSchema, reactToAgentMessage } from './agent-reactions.ts';
import {
    agentReminderCancelRequestSchema,
    agentReminderScheduleRequestSchema,
    agentReminderSnoozeRequestSchema,
    agentReminderUpdateRequestSchema,
    cancelAgentReminder,
    listAgentReminders,
    readAgentReminderLog,
    scheduleAgentReminder,
    snoozeAgentReminder,
    updateAgentReminder,
} from './agent-reminders.ts';
import { agentSendRequestSchema, sendAgentMessage } from './agent-send.ts';
import {
    agentSkillCreateRequestSchema,
    agentSkillPatchRequestSchema,
    agentSkillWriteFileRequestSchema,
    createAgentAuthoredSkill,
    deleteAgentSkill,
    listAgentSkills,
    patchAgentSkill,
    viewAgentSkill,
    writeAgentSkillFile,
} from './agent-skills.ts';
import {
    agentTaskClaimRequestSchema,
    agentTaskCreateRequestSchema,
    agentTaskListRequest,
    agentTaskUnclaimRequestSchema,
    agentTaskUpdateRequestSchema,
    claimAgentTasks,
    createAgentTasks,
    listAgentTasks,
    unclaimAgentTask,
    updateAgentTask,
} from './agent-tasks.ts';
import { agentThreadUnfollowRequestSchema, unfollowAgentThread } from './agent-threads.ts';
import { AmbiguousMessageIdError } from './chat-api/index.ts';
import { json, readJson } from './http.ts';

export async function handleAgentApiRequest(
    request: Request,
    agentId: string,
    options: { attachmentsDir?: string; skillsDir?: string } = {}
): Promise<Response | null> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/agent/')) {
        return null;
    }
    try {
        return await route(request, url, agentId, options);
    } catch (error) {
        if (error instanceof AmbiguousMessageIdError) {
            return agentError('AMBIGUOUS_ID', error.message, 409, 'Use the full message id.');
        }
        if (error instanceof AgentApiError) {
            return agentError(error.code, error.message, error.status, error.nextAction);
        }
        if (error instanceof ZodError) {
            return agentError('INVALID_ARG', error.issues[0]?.message ?? 'Invalid request.', 400);
        }
        throw error;
    }
}

async function route(
    request: Request,
    url: URL,
    agentId: string,
    options: { attachmentsDir?: string; skillsDir?: string }
): Promise<Response> {
    if (request.method === 'POST' && url.pathname === '/api/agent/messages/send') {
        return handleSend(request, agentId);
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/messages/react') {
        return json(
            reactToAgentMessage(agentId, agentReactionRequestSchema.parse(await readJson(request)))
        );
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/profile') {
        return json(readAgentProfile(agentId, url.searchParams.get('target')));
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/profile/update') {
        return json(
            updateAgentProfile(
                agentId,
                agentProfileUpdateRequestSchema.parse(await readJson(request))
            )
        );
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/attachments/upload') {
        return json(
            await uploadAgentAttachment(
                agentId,
                agentAttachmentUploadRequestSchema.parse(await readJson(request)),
                { attachmentsDir: options.attachmentsDir }
            )
        );
    }
    const attachmentMatch = url.pathname.match(/^\/api\/agent\/attachments\/([^/]+)$/u);
    if (request.method === 'GET' && attachmentMatch?.[1]) {
        return json(await viewAgentAttachment(agentId, decodeURIComponent(attachmentMatch[1])));
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/skills') {
        return json(await listAgentSkills(agentId, options.skillsDir));
    }
    const skillMatch = url.pathname.match(/^\/api\/agent\/skills\/([^/]+)$/u);
    if (request.method === 'GET' && skillMatch?.[1]) {
        return json(
            await viewAgentSkill(agentId, decodeURIComponent(skillMatch[1]), options.skillsDir)
        );
    }
    if (request.method === 'DELETE' && skillMatch?.[1]) {
        return json(
            await deleteAgentSkill(agentId, decodeURIComponent(skillMatch[1]), options.skillsDir)
        );
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/skills/create') {
        return json(
            await createAgentAuthoredSkill(
                agentId,
                agentSkillCreateRequestSchema.parse(await readJson(request)),
                options.skillsDir
            )
        );
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/skills/patch') {
        return json(
            await patchAgentSkill(
                agentId,
                agentSkillPatchRequestSchema.parse(await readJson(request)),
                options.skillsDir
            )
        );
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/skills/write-file') {
        return json(
            await writeAgentSkillFile(
                agentId,
                agentSkillWriteFileRequestSchema.parse(await readJson(request)),
                options.skillsDir
            )
        );
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/history') {
        return json(
            readAgentHistory(agentId, {
                after: url.searchParams.get('after'),
                around: url.searchParams.get('around'),
                before: url.searchParams.get('before'),
                limit: numberParam(url, 'limit'),
                target: requiredParam(url, 'target'),
            })
        );
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/messages/search') {
        return json(
            searchAgentMessages(agentId, {
                after: url.searchParams.get('after'),
                before: url.searchParams.get('before'),
                limit: numberParam(url, 'limit'),
                offset: numberParam(url, 'offset'),
                q: requiredParam(url, 'q'),
                sender: url.searchParams.get('sender'),
                sort: url.searchParams.get('sort'),
                target: url.searchParams.get('target'),
            })
        );
    }
    const messageMatch = url.pathname.match(/^\/api\/agent\/messages\/([^/]+)$/u);
    if (request.method === 'GET' && messageMatch?.[1]) {
        return json(getAgentMessage(agentId, decodeURIComponent(messageMatch[1])));
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/server') {
        return json(
            readAgentServerInfo(agentId, {
                agents: booleanParam(url, 'agents'),
                channels: booleanParam(url, 'channels'),
                humans: booleanParam(url, 'humans'),
                joined: booleanParam(url, 'joined'),
                limit: numberParam(url, 'limit'),
                offset: numberParam(url, 'offset'),
                query: url.searchParams.get('query') ?? undefined,
            })
        );
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/threads/unfollow') {
        return json(
            unfollowAgentThread(
                agentId,
                agentThreadUnfollowRequestSchema.parse(await readJson(request))
            )
        );
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/channels/info') {
        return json(readAgentChannelInfo(agentId, requiredParam(url, 'target')));
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/channels/members') {
        return json(readAgentChannelMembers(agentId, requiredParam(url, 'target')));
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/events') {
        return json(checkAgentMessages(agentId));
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/inbox') {
        return json(checkAgentInbox(agentId));
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/tasks') {
        return json(
            listAgentTasks(
                agentId,
                agentTaskListRequest.parse({
                    status: url.searchParams.get('status') ?? undefined,
                    target: url.searchParams.get('target') ?? undefined,
                })
            )
        );
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/tasks/create') {
        return json(
            createAgentTasks(agentId, agentTaskCreateRequestSchema.parse(await readJson(request)))
        );
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/tasks/claim') {
        return json(
            claimAgentTasks(agentId, agentTaskClaimRequestSchema.parse(await readJson(request)))
        );
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/tasks/unclaim') {
        return json(
            unclaimAgentTask(agentId, agentTaskUnclaimRequestSchema.parse(await readJson(request)))
        );
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/tasks/update') {
        return json(
            updateAgentTask(agentId, agentTaskUpdateRequestSchema.parse(await readJson(request)))
        );
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/reminders') {
        return json(
            listAgentReminders(agentId, {
                statuses: url.searchParams.get('status') ?? undefined,
            })
        );
    }
    if (request.method === 'GET' && url.pathname === '/api/agent/reminders/log') {
        return json(
            readAgentReminderLog(agentId, {
                id: url.searchParams.get('id') ?? undefined,
                limit: numberParam(url, 'limit'),
            })
        );
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/reminders/schedule') {
        return json(
            scheduleAgentReminder(
                agentId,
                agentReminderScheduleRequestSchema.parse(await readJson(request))
            )
        );
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/reminders/snooze') {
        return json(
            snoozeAgentReminder(
                agentId,
                agentReminderSnoozeRequestSchema.parse(await readJson(request))
            )
        );
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/reminders/update') {
        return json(
            updateAgentReminder(
                agentId,
                agentReminderUpdateRequestSchema.parse(await readJson(request))
            )
        );
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/reminders/cancel') {
        return json(
            cancelAgentReminder(
                agentId,
                agentReminderCancelRequestSchema.parse(await readJson(request))
            )
        );
    }
    const channelAction = url.pathname.match(/^\/api\/agent\/channels\/(join|leave|mute|unmute)$/u);
    if (request.method === 'POST' && channelAction?.[1]) {
        const input = agentChannelActionRequestSchema.parse(await readJson(request));
        const action = channelAction[1];
        if (action === 'join') {
            return json(joinAgentChannel(agentId, input));
        }
        if (action === 'leave') {
            return json(leaveAgentChannel(agentId, input));
        }
        if (action === 'mute') {
            return json(muteAgentChannel(agentId, input));
        }
        return json(unmuteAgentChannel(agentId, input));
    }
    return agentError('TARGET_NOT_FOUND', 'Agent API route was not found.', 404);
}

async function handleSend(request: Request, agentId: string): Promise<Response> {
    let resolvedChatId: string | null = null;
    try {
        const input = agentSendRequestSchema.parse(await readJson(request));
        return json(
            sendAgentMessage(agentId, input, {
                onTargetResolved: (chatId) => {
                    resolvedChatId = chatId;
                },
            })
        );
    } catch (error) {
        if (
            error instanceof AgentApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            resolvedChatId
        ) {
            return agentError(
                error.code,
                error.message,
                error.status,
                error.nextAction,
                Boolean(readAgentDraft(agentId, resolvedChatId))
            );
        }
        throw error;
    }
}

function agentError(
    code: string,
    message: string,
    status: number,
    nextAction?: string,
    draftSaved?: boolean
) {
    return json(
        {
            code,
            message,
            ...(draftSaved === undefined ? {} : { draftSaved }),
            ...(nextAction ? { nextAction } : {}),
        },
        status
    );
}

function requiredParam(url: URL, name: string): string {
    const value = url.searchParams.get(name);
    if (!value) {
        throw new AgentApiError('INVALID_ARG', `${name} is required.`, 400);
    }
    return value;
}

function numberParam(url: URL, name: string): number | undefined {
    const value = url.searchParams.get(name);
    if (value === null) {
        return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new AgentApiError('INVALID_ARG', `${name} is invalid.`, 400);
    }
    return parsed;
}

function booleanParam(url: URL, name: string): boolean | undefined {
    const value = url.searchParams.get(name);
    if (value === null) {
        return undefined;
    }
    if (value === '' || value === '1' || value === 'true') {
        return true;
    }
    if (value === '0' || value === 'false') {
        return false;
    }
    throw new AgentApiError('INVALID_ARG', `${name} must be true or false.`, 400);
}
