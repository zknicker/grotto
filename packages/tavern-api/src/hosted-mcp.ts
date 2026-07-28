import * as z from 'zod';
import { hostedIdSchema } from './hosted-chat.ts';

const mcpConnectionIdSchema = z
    .string()
    .regex(/^mcp_[A-Za-z0-9_-]{16}$/u, 'Invalid MCP connection id.');
const toolNameSchema = z.string().trim().min(1).max(200);
export const hostedMcpPresetSchema = z.enum(['google-calendar', 'merchbase']);

export const hostedMcpGrantSchema = z
    .object({
        agentId: hostedIdSchema,
        connectionId: mcpConnectionIdSchema,
    })
    .strict();

export const hostedMcpConnectionSchema = z
    .object({
        accountLabel: z.string().trim().min(1).max(200).nullable(),
        auth: z.enum(['headers', 'none', 'oauth']),
        connected: z.boolean(),
        grants: z.array(hostedMcpGrantSchema),
        headerNames: z.array(z.string()).max(50),
        id: mcpConnectionIdSchema,
        name: z.string().trim().min(1).max(100),
        preset: hostedMcpPresetSchema.nullable(),
        serverId: hostedIdSchema,
        status: z.enum(['online', 'pending']),
        tools: z.array(toolNameSchema),
        url: z.string().url(),
    })
    .strict();

export const hostedMcpConnectionCreateSchema = z
    .object({
        auth: z.enum(['headers', 'none', 'oauth']).default('none'),
        headers: z.record(z.string().trim().min(1), z.string().max(8000)).default({}),
        name: z.string().trim().min(1).max(100),
        oauthClientId: z.string().trim().min(1).max(1000).optional(),
        oauthClientSecret: z.string().max(4000).optional(),
        oauthScopes: z.array(z.string().trim().min(1).max(500)).max(100).default([]),
        serverId: hostedIdSchema,
        url: z.string().url().max(2000),
    })
    .strict()
    .superRefine((value, context) => {
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
        if (value.oauthClientSecret && !value.oauthClientId) {
            context.addIssue({
                code: 'custom',
                message: 'An OAuth client secret requires a client ID.',
            });
        }
        if (
            value.auth !== 'oauth' &&
            (value.oauthClientId || value.oauthClientSecret || value.oauthScopes.length > 0)
        ) {
            context.addIssue({
                code: 'custom',
                message: 'OAuth client settings require OAuth authentication.',
            });
        }
    });

export const hostedMcpPresetAccountCreateSchema = z
    .object({
        name: z.string().trim().min(1).max(100),
        preset: hostedMcpPresetSchema,
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedMcpOAuthStartSchema = z
    .object({
        allowAuthorizationServerOrigin: z.boolean().default(false),
        connectionId: mcpConnectionIdSchema,
        redirectUrl: z.string().url().max(2000),
        serverId: hostedIdSchema,
    })
    .strict();

export const hostedMcpOAuthStartResultSchema = z.discriminatedUnion('status', [
    z
        .object({
            authorizationUrl: z.string().url(),
            status: z.literal('ready'),
        })
        .strict(),
    z
        .object({
            authorizationServerOrigin: z.string().url(),
            status: z.literal('trust-required'),
        })
        .strict(),
]);

export const hostedMcpConnectionListInputSchema = z.object({ serverId: hostedIdSchema }).strict();
export const hostedMcpConnectionListSchema = z.array(hostedMcpConnectionSchema);
export const hostedMcpConnectionInputSchema = z
    .object({ connectionId: mcpConnectionIdSchema, serverId: hostedIdSchema })
    .strict();
export const hostedMcpHeadersUpdateSchema = hostedMcpConnectionInputSchema
    .extend({
        headers: z.record(z.string().trim().min(1), z.string().max(8000)),
    })
    .strict();

export const hostedMcpGrantInputSchema = hostedMcpGrantSchema.extend({
    enabled: z.boolean(),
    serverId: hostedIdSchema,
});

export type HostedMcpConnection = z.infer<typeof hostedMcpConnectionSchema>;
export type HostedMcpConnectionCreate = z.infer<typeof hostedMcpConnectionCreateSchema>;
export type HostedMcpGrant = z.infer<typeof hostedMcpGrantSchema>;
export type HostedMcpOAuthStart = z.infer<typeof hostedMcpOAuthStartSchema>;
export type HostedMcpOAuthStartResult = z.infer<typeof hostedMcpOAuthStartResultSchema>;
export type HostedMcpPreset = z.infer<typeof hostedMcpPresetSchema>;
export type HostedMcpPresetAccountCreate = z.infer<typeof hostedMcpPresetAccountCreateSchema>;
