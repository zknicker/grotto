import type { AgentInboxItem } from './launch.ts';

const deliveryTrailer = [
    'Respond as appropriate. Complete all your work before stopping.',
    "Reply in the channel or create/reply in a thread as appropriate; use each message's `target` and `msg` fields to choose the exact target.",
].join('\n');

/** Exact model-visible drain shape from specs/inbox.md. */
export function composeInboxDrain(items: AgentInboxItem[], homeTimezone = 'UTC'): string {
    if (items.length === 0) {
        return 'Start.';
    }
    return [
        items.length === 1 ? 'New message received:' : 'New messages received:',
        '',
        ...items.map((item) => formatEnvelope(item, homeTimezone)),
        '',
        deliveryTrailer,
    ].join('\n');
}

/** Content-free, target-level busy notice. Bodies never enter this projection. */
export function composeInboxNotice(
    items: AgentInboxItem[],
    totalPending = items.length
): string | null {
    if (items.length === 0) {
        return null;
    }
    const targets = new Map<string, AgentInboxItem[]>();
    for (const item of items) {
        const rows = targets.get(item.target) ?? [];
        rows.push(item);
        targets.set(item.target, rows);
    }
    const lines = [...targets.entries()].map(([target, rows]) => {
        const ordered = [...rows].sort(compareItems);
        const first = ordered[0];
        const latest = ordered.at(-1);
        if (!(first && latest)) {
            throw new Error('Inbox notice target cannot be empty.');
        }
        return [
            target,
            `  pending: ${ordered.length} ${plural(ordered.length, 'message')}`,
            ` · first msg=${shortId(first.id)}`,
            ` · latest sender @${latest.senderHandle}`,
            ` · latest msg=${shortId(latest.id)}`,
            noticeTag(target, ordered),
        ].join('');
    });
    return [
        '[Grotto inbox notice:',
        `Inbox update: ${totalPending} unread ${plural(totalPending, 'message')} total; ${targets.size} changed ${plural(targets.size, 'target')}`,
        ...lines,
        ']',
    ].join('\n');
}

function plural(count: number, singular: string): string {
    return count === 1 ? singular : `${singular}s`;
}

function formatEnvelope(item: AgentInboxItem, homeTimezone: string): string {
    const sender = item.senderDescription
        ? `@${item.senderHandle} — ${item.senderDescription}`
        : `@${item.senderHandle}`;
    const task = item.task
        ? ` task=#${item.task.number}:${item.task.status}:${taskAssignee(item)}`
        : '';
    const mention = item.mentioned ? ' mentioned=true' : '';
    const envelope =
        `[target=${item.target} msg=${shortId(item.id)} time=${formatLocalTime(item.createdAt, homeTimezone)} type=${item.senderType}${task}${mention}] ` +
        `${sender}: ${item.content}`;
    return item.threadFollowReactivated
        ? `${formatThreadFollowRestoration(item.target)}\n${envelope}`
        : envelope;
}

export function formatThreadFollowRestoration(target: string): string {
    return [
        `[Grotto thread follow restored: this @mention re-subscribed you to ordinary replies in ${target}.]`,
        `To stop those replies again: grotto thread unfollow --target "${target}"`,
    ].join('\n');
}

function taskAssignee(item: AgentInboxItem): string {
    if (!item.task) {
        return 'unassigned';
    }
    return item.task.assigneeAgentId ?? item.task.assigneeUserId ?? 'unassigned';
}

function formatLocalTime(timestamp: string, homeTimezone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23',
        minute: '2-digit',
        month: '2-digit',
        second: '2-digit',
        timeZone: homeTimezone,
        year: 'numeric',
    }).formatToParts(new Date(timestamp));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? '';
    return `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')}`;
}

function noticeTag(target: string, items: AgentInboxItem[]): string {
    const latest = items.at(-1);
    const tags = [
        target.startsWith('dm:') ? 'dm' : target.includes(':') ? 'thread' : null,
        latest?.task ? `task #${latest.task.number}` : null,
        items.some((item) => item.mentioned) ? 'you were mentioned' : null,
    ].filter(Boolean);
    return tags.length > 0 ? ` · ${tags.join(' · ')}` : '';
}

function shortId(id: string): string {
    return id.replace(/^[a-z]+_/u, '').slice(0, 8) || '-';
}

function compareItems(left: AgentInboxItem, right: AgentInboxItem): number {
    return (
        left.createdAt.localeCompare(right.createdAt) ||
        left.sequence - right.sequence ||
        left.id.localeCompare(right.id)
    );
}
