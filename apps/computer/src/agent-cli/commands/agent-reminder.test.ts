import { describe, expect, test } from 'bun:test';
import type * as z from 'zod';
import type { AgentApiRequest, AgentApiRequester } from '../agent-api-client.ts';
import { AgentCliError } from '../agent-error.ts';
import type { ParsedArgs } from '../parse.ts';
import {
    runReminderCancel,
    runReminderSchedule,
    runReminderSnooze,
    runReminderUpdate,
} from './agent-reminder.ts';

const reminder = {
    anchorTarget: '#general:deadbeef',
    fireAt: '2026-07-30T16:00:00.000Z',
    id: 'rem_test',
    repeat: null,
    script: false,
    status: 'scheduled',
    title: 'Check the draft',
    version: 7,
};

describe('Agent reminder CLI', () => {
    test('retries a schedule with the same idempotency key', async () => {
        const requests: AgentApiRequest[] = [];
        let attempts = 0;
        const client = requester((route, input) => {
            expect(route).toBe('/api/agent/reminders/schedule');
            requests.push(input);
            attempts++;
            if (attempts === 1) {
                throw new AgentCliError('SERVER_5XX', 'retry');
            }
            return { reminder };
        });

        await runReminderSchedule(
            args({
                '--delay-seconds': '120',
                '--message-id': 'deadbeef',
                '--title': 'Check the draft',
            }),
            { client, write: () => undefined }
        );

        expect(requests).toHaveLength(2);
        expect(requests[0]).toEqual(requests[1]);
        expect(requests[0]?.body).toMatchObject({
            commandId: expect.stringMatching(/^cli-/u),
            fireAt: expect.stringMatching(/Z$/u),
            messageId: 'deadbeef',
            title: 'Check the draft',
        });
        expect(requests[0]?.body).not.toHaveProperty('delaySeconds');
    });

    test('uses the listed reminder version for every mutation', async () => {
        const mutations: { input: AgentApiRequest; route: string }[] = [];
        const client = requester((route, input) => {
            if (route === '/api/agent/reminders') {
                return { reminders: [reminder] };
            }
            mutations.push({ input, route });
            return { reminder: { ...reminder, version: reminder.version + 1 } };
        });
        const deps = { client, write: () => undefined };

        await runReminderSnooze(args({ '--by': '2h', '--id': reminder.id }), deps);
        await runReminderUpdate(args({ '--id': reminder.id, '--title': 'Check CI' }), deps);
        await runReminderCancel(args({ '--id': reminder.id }), deps);

        expect(mutations.map(({ route }) => route)).toEqual([
            '/api/agent/reminders/snooze',
            '/api/agent/reminders/update',
            '/api/agent/reminders/cancel',
        ]);
        for (const { input } of mutations) {
            expect(input.body).toMatchObject({
                commandId: expect.stringMatching(/^cli-/u),
                expectedVersion: reminder.version,
                id: reminder.id,
            });
        }
    });
});

function args(values: Record<string, string>): ParsedArgs {
    return { flags: {}, help: false, positionals: [], values };
}

function requester(respond: (route: string, input: AgentApiRequest) => unknown): AgentApiRequester {
    return {
        async request<T>(
            route: string,
            schema: z.ZodType<T>,
            input: AgentApiRequest = {}
        ): Promise<T> {
            return schema.parse(respond(route, input));
        },
    };
}
