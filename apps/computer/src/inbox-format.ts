import type { AgentInboxAsk, AgentInboxItem } from './launch.ts';

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
    const hasActionAttention = items.some((item) => item.actionAttention);
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
            `  pending: ${ordered.length} ${plural(ordered.length, ordered.some((item) => item.actionAttention) ? 'work item' : 'message')}`,
            ` · first msg=${shortInboxId(first.id)}`,
            ` · latest sender @${latest.senderHandle}`,
            ` · latest msg=${shortInboxId(latest.id)}`,
            noticeTag(target, ordered),
        ].join('');
    });
    return [
        '[Grotto inbox notice:',
        hasActionAttention
            ? `Inbox update: ${totalPending} pending ${plural(totalPending, 'work item')} total; ${targets.size} changed ${plural(targets.size, 'target')}`
            : `Inbox update: ${totalPending} unread ${plural(totalPending, 'message')} total; ${targets.size} changed ${plural(targets.size, 'target')}`,
        ...lines,
        ']',
    ].join('\n');
}

function plural(count: number, singular: string): string {
    return count === 1 ? singular : `${singular}s`;
}

function formatEnvelope(item: AgentInboxItem, homeTimezone: string): string {
    if (item.actionAttention) {
        return formatActionAttention(item);
    }
    const sender = item.senderDescription
        ? `@${item.senderHandle} — ${item.senderDescription}`
        : `@${item.senderHandle}`;
    const task = item.task
        ? ` task=#${item.task.number}:${item.task.status}:${taskAssignee(item)}`
        : '';
    const ask = item.ask ? formatAskMarker(item.ask) : '';
    const mention = item.mentioned ? ' mentioned=true' : '';
    const envelope =
        `[target=${item.target} msg=${shortInboxId(item.id)} time=${formatLocalTime(item.createdAt, homeTimezone)} type=${item.senderType}${task}${ask}${mention}] ` +
        `${sender}: ${item.content}`;
    return item.threadFollowReactivated
        ? `${formatThreadFollowRestoration(item.target)}\n${envelope}`
        : envelope;
}

function formatActionAttention(item: AgentInboxItem): string {
    const attention = item.actionAttention;
    if (!attention) {
        throw new Error('Action attention is required.');
    }
    return [
        `[Grotto action attention kind=${attention.kind} action=${attention.actionId} target=${item.target}]`,
        `The committed action completed. createdAgentId=${attention.createdAgentId}`,
        `executedResult=${JSON.stringify(attention.executedResult)}`,
    ].join('\n');
}

/**
 * One owner of Ask presentation. The delivery envelope, the drain envelope, and
 * the busy notice read the same status and addressee; only the grammar differs.
 */
export function formatAskSuffix(ask: AgentInboxAsk): string {
    return ` [ask status=${ask.status}${askAddressee(ask)}]`;
}

/** The notice tag: content-free, and shaped like the `task #N` tag beside it. */
export function formatAskTag(ask: AgentInboxAsk): string {
    return `ask ${ask.status}${askAddressee(ask)}`;
}

/** The drain marker: compressed like the `task=#N:status:assignee` marker beside it. */
export function formatAskMarker(ask: AgentInboxAsk): string {
    const handle = askHandle(ask);
    return ` ask=${ask.status}${handle ? `:${handle}` : ''}`;
}

function askAddressee(ask: AgentInboxAsk): string {
    const handle = askHandle(ask);
    return handle ? ` to=${handle}` : '';
}

function askHandle(ask: AgentInboxAsk): string | null {
    return ask.addresseeHandle ? `@${ask.addresseeHandle}` : null;
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
        latest?.ask ? formatAskTag(latest.ask) : null,
        items.some((item) => item.actionAttention) ? 'action attention' : null,
        items.some((item) => item.mentioned) ? 'you were mentioned' : null,
    ].filter(Boolean);
    return tags.length > 0 ? ` · ${tags.join(' · ')}` : '';
}

/**
 * An automation fire id: a Trigger fire (`trf_…`) or a Reminder fire (`rmf_…`).
 * A fire writes no Chat message, so its id addresses nothing the Agent can
 * read, thread on, react to, or hand to `--message-id`. The fire's own
 * `fire=<id>` line and its `--cause <fireId>` reply line carry the id that does
 * work.
 */
function isAutomationFireId(id: string): boolean {
    return /^(?:rmf|trf)_/u.test(id);
}

/**
 * The `msg=` short id every inbox surface prints, for messages and for the
 * bodiless items alike. A compound assignment key
 * (`task-assign:<messageId>:<version>`) shortens to the task message it hands
 * over, which is the id the Agent can actually address — reading it, threading
 * on it, or reacting to it. A fire has no such message, so it prints `-`
 * rather than an id the Agent would spend a failed command on.
 */
export function shortInboxId(id: string): string {
    if (isAutomationFireId(id)) {
        return '-';
    }
    const assignment = /^task-assign:(?<messageId>[^:]+):/u.exec(id);
    const subject = assignment?.groups?.messageId ?? id;
    return subject.replace(/^[a-z]+_/u, '').slice(0, 8) || '-';
}

function compareItems(left: AgentInboxItem, right: AgentInboxItem): number {
    return (
        left.createdAt.localeCompare(right.createdAt) ||
        left.sequence - right.sequence ||
        left.id.localeCompare(right.id)
    );
}
