import type { AgentCliMessage } from './agent-api-schemas.ts';
import { AgentCliError } from './agent-error.ts';

export function formatLocalTime(timestamp: string): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        throw new AgentCliError('INVALID_JSON_RESPONSE', `Invalid message time: ${timestamp}`);
    }
    return [
        date.getFullYear(),
        '-',
        pad(date.getMonth() + 1),
        '-',
        pad(date.getDate()),
        ' ',
        pad(date.getHours()),
        ':',
        pad(date.getMinutes()),
        ':',
        pad(date.getSeconds()),
    ].join('');
}

export function formatHistoryLine(message: AgentCliMessage): string {
    const attributes = [
        `seq=${message.sequence}`,
        `msg=${message.id}`,
        `time=${formatLocalTime(message.created_at)}`,
        `type=${message.sender.type}`,
        ...(message.threadId ? [`threadId=${message.threadId}`] : []),
        ...(message.replyCount !== undefined ? [`replyCount=${message.replyCount}`] : []),
        ...(message.replyTarget ? [`replyTarget=${message.replyTarget}`] : []),
    ];
    return `[${attributes.join(' ')}] ${formatSender(message)}: ${message.content}${attachmentSuffix(message)}${taskSuffix(message)}`;
}

export function formatDeliveryEnvelope(target: string, message: AgentCliMessage): string {
    const attributes = [
        `target=${target}`,
        `msg=${shortMessageId(message.id)}`,
        `time=${formatLocalTime(message.created_at)}`,
        `type=${message.sender.type}`,
    ];
    return `[${attributes.join(' ')}] ${formatSender(message)}: ${message.content}${attachmentSuffix(message)}${taskSuffix(message)}`;
}

export function attachmentSuffix(message: AgentCliMessage): string {
    if (message.attachments.length === 0) {
        return '';
    }
    const described = message.attachments.flatMap((attachment) => {
        const id = attachment.id;
        const filename = attachment.filename;
        return typeof id === 'string' && typeof filename === 'string'
            ? [`${filename} (id:${id})`]
            : [];
    });
    const count = message.attachments.length;
    const noun = count === 1 ? 'attachment' : 'attachments';
    if (described.length !== count) {
        return ` [${count} ${noun}]`;
    }
    return ` [${count} ${noun}: ${described.join(', ')} — use grotto attachment view to download]`;
}

/** Task-messages ride every surface with their metadata suffix (D8). */
export function taskSuffix(message: AgentCliMessage): string {
    const task = message.task;
    if (!task) {
        return '';
    }
    const assignee = task.assignee?.handle ? ` assignee=@${task.assignee.handle}` : '';
    return ` [task #${task.number} status=${task.status}${assignee}]`;
}

export function formatSender(message: AgentCliMessage): string {
    // System and unlabeled authors legitimately have no handle (Raft renders
    // them as @unknown too); never fail a whole read over one such row.
    const handle = message.sender.handle ?? 'unknown';
    return message.sender.description ? `@${handle} — ${message.sender.description}` : `@${handle}`;
}

export function shortMessageId(messageId: string): string {
    return messageId.startsWith('msg_') ? messageId.slice(4, 12) : messageId;
}

function pad(value: number): string {
    return String(value).padStart(2, '0');
}
