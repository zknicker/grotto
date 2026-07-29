import { publishRuntimeEvent } from './runtime-events.ts';

export function publishReminderUpdated() {
    publishRuntimeEvent({
        timestamp: new Date().toISOString(),
        type: 'reminder.updated',
    });
}
