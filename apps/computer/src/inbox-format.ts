import type { HostedAgentInboxItem } from './launch.ts';

const deliveryTrailer = [
    'Respond as appropriate. Complete all your work before stopping.',
    "Reply in the channel or create/reply in a thread as appropriate; use each message's `target` and `msg` fields to choose the exact target.",
].join('\n');

/** Exact model-visible drain shape from specs/raft-alignment/ws2-turn-shapes.md. */
export function composeInboxDrain(items: HostedAgentInboxItem[], homeTimezone = 'UTC'): string {
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
export function composeInboxNotice(items: HostedAgentInboxItem[]): string | null {
    if (items.length === 0) {
        return null;
    }
    const targets = new Map<string, HostedAgentInboxItem[]>();
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
            ` pending: ${ordered.length} message(s)`,
            ` · first msg=${shortId(first.id)}`,
            ` · latest sender @${latest.senderHandle}`,
            ` · latest msg=${shortId(latest.id)}`,
            noticeTag(target),
        ].join('');
    });
    return [
        '[Grotto inbox notice:',
        `Inbox update: ${items.length} unread messages total; ${targets.size} changed target(s)`,
        ...lines,
        ']',
    ].join('\n');
}

function formatEnvelope(item: HostedAgentInboxItem, homeTimezone: string): string {
    const sender = item.senderDescription
        ? `@${item.senderHandle} — ${item.senderDescription}`
        : `@${item.senderHandle}`;
    return (
        `[target=${item.target} msg=${shortId(item.id)} time=${formatLocalTime(item.createdAt, homeTimezone)} type=${item.senderType}] ` +
        `${sender}: ${item.content}`
    );
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

function noticeTag(target: string): string {
    if (target.startsWith('dm:')) {
        return ' · dm';
    }
    return target.includes(':') ? ' · thread' : '';
}

function shortId(id: string): string {
    return id.replace(/^[a-z]+_/u, '').slice(0, 8) || '-';
}

function compareItems(left: HostedAgentInboxItem, right: HostedAgentInboxItem): number {
    return (
        left.createdAt.localeCompare(right.createdAt) ||
        left.sequence - right.sequence ||
        left.id.localeCompare(right.id)
    );
}
