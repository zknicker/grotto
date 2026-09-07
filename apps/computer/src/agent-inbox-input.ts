import { cloudAgentWorkAttentionSchema } from '@grotto/api';
import type {
    AgentActionAttention,
    AgentCloudAgentWorkAttention,
    AgentInboxItem,
} from './launch.ts';

export function parseInbox(value: unknown): AgentInboxItem[] | null {
    if (!Array.isArray(value) || value.length > 100) {
        return null;
    }
    const inbox: AgentInboxItem[] = [];
    for (const valueItem of value) {
        const item = parseInboxItem(valueItem);
        if (!item) {
            return null;
        }
        inbox.push(item);
    }
    return inbox;
}

function parseInboxItem(item: unknown): AgentInboxItem | null {
    if (
        !(
            isRecord(item) &&
            ['chatId', 'createdAt', 'id', 'senderHandle', 'target'].every(
                (field) => typeof item[field] === 'string' && item[field].length > 0
            ) &&
            typeof item.content === 'string' &&
            (item.senderDescription === undefined || typeof item.senderDescription === 'string') &&
            (item.message === undefined || isRecord(item.message)) &&
            (item.threadFollowReactivated === undefined ||
                typeof item.threadFollowReactivated === 'boolean') &&
            ['agent', 'human', 'system', 'trigger'].includes(item.senderType as string)
        ) ||
        typeof item.sequence !== 'number' ||
        !Number.isInteger(item.sequence) ||
        item.sequence < 0
    ) {
        return null;
    }
    const actionAttention = parseActionAttention(item.actionAttention);
    if (item.actionAttention !== undefined && !actionAttention) {
        return null;
    }
    const cloudAgentWork = parseCloudAgentWorkAttention(item.cloudAgentWork);
    if (item.cloudAgentWork !== undefined && !cloudAgentWork) {
        return null;
    }
    if (actionAttention && cloudAgentWork) {
        return null;
    }
    if (invalidAttentionIdentity(item, actionAttention, cloudAgentWork)) {
        return null;
    }
    return {
        ...item,
        ...(actionAttention ? { actionAttention } : {}),
        ...(cloudAgentWork ? { cloudAgentWork } : {}),
    } as unknown as AgentInboxItem;
}

function invalidAttentionIdentity(
    item: Record<string, unknown>,
    action: AgentActionAttention | null | undefined,
    work: AgentCloudAgentWorkAttention | null | undefined
): boolean {
    if (action) {
        return (
            item.sequence !== 0 ||
            item.id !== action.actionId ||
            item.chatId !== action.chatId ||
            item.senderType !== 'system'
        );
    }
    if (work) {
        return item.sequence !== 0 || item.id !== work.runId || item.senderType !== 'system';
    }
    return item.sequence === 0;
}

function parseCloudAgentWorkAttention(
    value: unknown
): AgentCloudAgentWorkAttention | undefined | null {
    if (value === undefined) {
        return undefined;
    }
    const parsed = cloudAgentWorkAttentionSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

function parseActionAttention(value: unknown): AgentActionAttention | undefined | null {
    if (value === undefined) {
        return undefined;
    }
    if (
        !isRecord(value) ||
        value.kind !== 'agent:create' ||
        typeof value.actionId !== 'string' ||
        value.actionId.length === 0 ||
        typeof value.chatId !== 'string' ||
        value.chatId.length === 0 ||
        typeof value.createdAgentId !== 'string' ||
        value.createdAgentId.length === 0 ||
        !isRecord(value.executedResult)
    ) {
        return null;
    }
    const result = value.executedResult;
    const stringFields = [
        'agentId',
        'chatId',
        'computerId',
        'displayName',
        'handle',
        'modelId',
        'runtimeId',
    ] as const;
    if (
        stringFields.some(
            (field) => typeof result[field] !== 'string' || result[field].length === 0
        ) ||
        (result.avatarUrl !== null && typeof result.avatarUrl !== 'string') ||
        (result.description !== null && typeof result.description !== 'string') ||
        !['high', 'low', 'medium'].includes(result.reasoningEffort as string) ||
        result.role !== 'member'
    ) {
        return null;
    }
    return {
        actionId: value.actionId,
        chatId: value.chatId,
        createdAgentId: value.createdAgentId,
        executedResult: result as AgentActionAttention['executedResult'],
        kind: 'agent:create',
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
