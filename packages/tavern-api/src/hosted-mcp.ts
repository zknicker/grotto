import * as z from 'zod';
import { hostedIdSchema } from './hosted-chat.ts';

const mcpConnectionIdSchema = z
    .string()
    .regex(/^mcp_[A-Za-z0-9_-]{16}$/u, 'Invalid MCP connection id.');
const toolNameSchema = z.string().trim().min(1).max(200);

export const hostedMcpConnectionSchema = z
    .object({
        args: z.array(z.string()).max(50),
        auth: z.enum(['headers', 'none']),
        command: z.string().nullable(),
        computerId: hostedIdSchema,
        headerNames: z.array(z.string()).max(50),
        id: mcpConnectionIdSchema,
        name: z.string().trim().min(1).max(100),
        serverId: hostedIdSchema,
        status: z.enum(['online', 'pending']),
        tools: z.array(toolNameSchema),
        transport: z.enum(['http', 'stdio']),
        url: z.string().url().nullable(),
    })
    .strict();

export const hostedMcpConnectionCreateSchema = z
    .object({
        args: z.array(z.string().trim().min(1)).max(50).default([]),
        command: z.string().trim().min(1).max(500).optional(),
        computerId: hostedIdSchema,
        env: z.record(z.string().trim().min(1), z.string().max(4000)).default({}),
        headers: z.record(z.string().trim().min(1), z.string().max(8000)).default({}),
        name: z.string().trim().min(1).max(100),
        serverId: hostedIdSchema,
        url: z.string().url().max(2000).optional(),
    })
    .strict()
    .refine((value) => Boolean(value.command) !== Boolean(value.url), {
        message: 'Provide either a URL or a command.',
    })
    .superRefine((value, context) => {
        if (!value.url) {
            return;
        }
        const url = new URL(value.url);
        const loopback = ['127.0.0.1', '::1', 'localhost'].includes(url.hostname);
        if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
            context.addIssue({
                code: 'custom',
                message: 'HTTP MCP connections must use HTTPS or loopback HTTP.',
            });
        }
        if (url.username || url.password) {
            context.addIssue({ code: 'custom', message: 'MCP URLs cannot contain credentials.' });
        }
    });

export const hostedMcpConnectionListInputSchema = z.object({ serverId: hostedIdSchema }).strict();
export const hostedMcpConnectionListSchema = z.array(hostedMcpConnectionSchema);

export const hostedMcpGrantSchema = z
    .object({
        agentId: hostedIdSchema,
        connectionId: mcpConnectionIdSchema,
        toolName: toolNameSchema,
    })
    .strict();
export const hostedMcpGrantInputSchema = hostedMcpGrantSchema.extend({
    enabled: z.boolean(),
    serverId: hostedIdSchema,
});

export type HostedMcpConnection = z.infer<typeof hostedMcpConnectionSchema>;
export type HostedMcpConnectionCreate = z.infer<typeof hostedMcpConnectionCreateSchema>;
export type HostedMcpGrant = z.infer<typeof hostedMcpGrantSchema>;
