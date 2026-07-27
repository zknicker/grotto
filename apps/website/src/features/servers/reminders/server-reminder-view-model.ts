import type { HostedReminder } from '@tavern/api';
import { formatTimestamp } from '../../../lib/format.ts';

export interface HostedReminderFilters {
    agentId: string | null;
    query: string;
    status: 'all' | HostedReminder['status'];
}

export function toHostedReminderListItem(reminder: HostedReminder) {
    const schedule = reminder.repeat
        ? `${reminder.repeat} · next ${formatTimestamp(reminder.fireAt)}`
        : `Fires ${formatTimestamp(reminder.fireAt)}`;
    return {
        anchorChatId: reminder.anchorChatId,
        fireAt: reminder.fireAt,
        id: reminder.id,
        isScript: reminder.hasScript,
        ownerAgentId: reminder.ownerAgentId,
        ownerLabel: `@${reminder.ownerHandle}`,
        repeat: reminder.repeat,
        schedule,
        scriptLabel: reminder.hasScript
            ? `Script · ${reminder.scriptBytes} bytes · local execution only`
            : null,
        status: reminder.status,
        title: reminder.title,
        version: reminder.version,
    };
}

export type HostedReminderListItem = ReturnType<typeof toHostedReminderListItem>;

export function filterHostedReminders(reminders: HostedReminder[], filters: HostedReminderFilters) {
    const query = filters.query.trim().toLowerCase();
    return reminders.filter((reminder) => {
        if (filters.agentId && reminder.ownerAgentId !== filters.agentId) {
            return false;
        }
        if (filters.status !== 'all' && reminder.status !== filters.status) {
            return false;
        }
        return (
            query.length === 0 ||
            reminder.title.toLowerCase().includes(query) ||
            reminder.ownerHandle.toLowerCase().includes(query) ||
            reminder.repeat?.toLowerCase().includes(query) === true
        );
    });
}
