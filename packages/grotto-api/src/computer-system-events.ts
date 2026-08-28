import * as z from 'zod';

const occurredAtSchema = z.iso.datetime({ offset: true });
const systemEventIdSchema = z.string().regex(/^cse_[A-Za-z0-9_-]{16}$/u);

export const computerManagementCommandSchema = z.enum([
    'start',
    'stop',
    'restart',
    'upgrade',
    'rollback',
]);
export type ComputerManagementCommand = z.infer<typeof computerManagementCommandSchema>;

export const computerManagementEventSchema = z
    .object({
        command: computerManagementCommandSchema,
        id: systemEventIdSchema,
        occurredAt: occurredAtSchema,
        type: z.literal('management-command'),
    })
    .strict();

export type ComputerManagementEvent = z.infer<typeof computerManagementEventSchema>;

export const computerSystemEventReportSchema = z
    .object({
        events: z.array(computerManagementEventSchema).max(100),
        type: z.literal('system-event-report'),
    })
    .strict();

export type ComputerSystemEventReport = z.infer<typeof computerSystemEventReportSchema>;

export const computerSystemEventSchema = z.discriminatedUnion('type', [
    computerManagementEventSchema,
    z
        .object({
            id: systemEventIdSchema,
            occurredAt: occurredAtSchema,
            type: z.literal('connected'),
        })
        .strict(),
    z
        .object({
            id: systemEventIdSchema,
            occurredAt: occurredAtSchema,
            reason: z.enum(['heartbeat-timeout', 'socket-closed', 'server-restarted']),
            type: z.literal('disconnected'),
        })
        .strict(),
]);

export type ComputerSystemEvent = z.infer<typeof computerSystemEventSchema>;
