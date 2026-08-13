import { Alert, Button, Chip } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { useReminders } from '../../../hooks/servers/use-reminders.ts';
import { filterReminders, type ReminderItem, toReminderItem } from './reminder-model.ts';
import { useReminderView } from './use-reminder-view.ts';

export function ReminderList({
    onCancel,
    onOpenRuns,
    serverId,
}: {
    onCancel: (reminderId: string) => void;
    onOpenRuns: (reminderId: string) => void;
    serverId: string;
}) {
    const reminders = useReminders(serverId);
    const { filters } = useReminderView();
    const items = filterReminders(reminders.data ?? [], filters).map(toReminderItem);

    return (
        <>
            {reminders.error ? (
                <div className="px-6 pt-4">
                    <Alert role="alert" status="danger">
                        <Alert.Indicator />
                        <Alert.Content>
                            <Alert.Description>{reminders.error.message}</Alert.Description>
                        </Alert.Content>
                    </Alert>
                </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                {reminders.isPending ? (
                    <div aria-busy="true" className="min-h-full">
                        <span className="sr-only">Loading reminders</span>
                    </div>
                ) : (
                    <ReminderItems items={items} onCancel={onCancel} onOpenRuns={onOpenRuns} />
                )}
            </div>
        </>
    );
}

export function ReminderItems({
    items,
    onCancel,
    onOpenRuns,
}: {
    items: ReminderItem[];
    onCancel: (reminderId: string) => void;
    onOpenRuns: (reminderId: string) => void;
}) {
    if (items.length === 0) {
        return (
            <EmptyState>
                <EmptyState.Header>
                    <EmptyState.Title>No hosted reminders</EmptyState.Title>
                    <EmptyState.Description>
                        Agents schedule reminders from messages and Threads. There is no creation or
                        execution control on this operator page.
                    </EmptyState.Description>
                </EmptyState.Header>
            </EmptyState>
        );
    }

    return (
        <ul className="grid gap-px overflow-hidden rounded-xl border border-separator">
            {items.map((reminder) => (
                <ReminderRow
                    key={reminder.id}
                    onCancel={onCancel}
                    onOpenRuns={onOpenRuns}
                    reminder={reminder}
                />
            ))}
        </ul>
    );
}

function ReminderRow({
    onCancel,
    onOpenRuns,
    reminder,
}: {
    onCancel: (reminderId: string) => void;
    onOpenRuns: (reminderId: string) => void;
    reminder: ReminderItem;
}) {
    return (
        <li className="flex flex-wrap items-center gap-3 bg-surface px-4 py-3">
            <div className="min-w-52 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-foreground text-sm">{reminder.title}</h3>
                    <Chip
                        color={reminder.status === 'scheduled' ? 'success' : 'default'}
                        size="sm"
                        variant="soft"
                    >
                        {reminder.status}
                    </Chip>
                </div>
                <p className="text-muted text-xs">
                    {reminder.ownerLabel} · {reminder.schedule}
                </p>
                {reminder.scriptLabel ? (
                    <p className="mt-1 font-mono text-muted text-xs">{reminder.scriptLabel}</p>
                ) : null}
            </div>
            <Button onPress={() => onOpenRuns(reminder.id)} size="sm" variant="ghost">
                Fire Log
            </Button>
            {reminder.status === 'scheduled' ? (
                <Button onPress={() => onCancel(reminder.id)} size="sm" variant="danger-soft">
                    Cancel Reminder
                </Button>
            ) : null}
        </li>
    );
}
