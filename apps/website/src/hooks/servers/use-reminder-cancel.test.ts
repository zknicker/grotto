import { expect, test } from 'bun:test';
import { createReminderCancelOptions } from './use-reminder-cancel.ts';

test('successful hosted cancellation refreshes list and run state without realtime', async () => {
    const invalidations: string[] = [];
    const options = createReminderCancelOptions({
        reminder: {
            list: {
                invalidate: async ({ serverId }) => {
                    invalidations.push(`list:${serverId}`);
                },
            },
            runs: {
                invalidate: async ({ serverId }) => {
                    invalidations.push(`runs:${serverId}`);
                },
            },
        },
    });

    await options.onSuccess(undefined, { serverId: 'srv_hosted' });

    expect(invalidations).toEqual(['list:srv_hosted', 'runs:srv_hosted']);
});
