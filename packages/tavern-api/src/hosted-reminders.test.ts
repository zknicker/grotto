import { describe, expect, test } from 'bun:test';
import {
    hostedReminderCancelInputSchema,
    hostedReminderListInputSchema,
    hostedReminderRunsSchema,
    hostedReminderSchema,
} from './hosted-reminders.ts';

describe('hosted reminder contracts', () => {
    test('keeps operator state narrow and never exposes script contents', () => {
        const reminder = hostedReminderSchema.parse({
            anchorChatId: 'cht_all',
            anchorMessageId: 'msg_anchor',
            createdAt: '2026-07-26T12:00:00.000Z',
            fireAt: '2026-07-27T13:00:00.000Z',
            hasScript: true,
            id: 'rem_one',
            ownerAgentId: 'agt_cove',
            ownerHandle: 'Cove',
            repeat: 'daily@09:00',
            scriptBytes: 12,
            status: 'scheduled',
            timezone: 'America/New_York',
            title: 'Check health',
            updatedAt: '2026-07-26T12:00:00.000Z',
            version: 1,
        });

        expect(reminder).not.toHaveProperty('script');
        expect(() => hostedReminderSchema.parse({ ...reminder, script: 'secret' })).toThrow();
        expect(
            hostedReminderListInputSchema.parse({
                agentId: 'agt_cove',
                serverId: 'srv_one',
                status: 'scheduled',
            })
        ).toEqual({
            agentId: 'agt_cove',
            serverId: 'srv_one',
            status: 'scheduled',
        });
    });

    test('requires idempotent optimistic cancellation and typed fire logs', () => {
        expect(
            hostedReminderCancelInputSchema.parse({
                commandId: 'cancel-1',
                expectedVersion: 2,
                reminderId: 'rem_one',
                serverId: 'srv_one',
            })
        ).toMatchObject({ expectedVersion: 2 });
        expect(
            hostedReminderRunsSchema.parse([
                {
                    firedAt: '2026-07-26T14:00:00.000Z',
                    id: 'rmf_one',
                    receiptMessageId: 'msg_receipt',
                    reminderId: 'rem_one',
                    scheduledFor: '2026-07-26T13:00:00.000Z',
                },
            ])
        ).toHaveLength(1);
    });
});
