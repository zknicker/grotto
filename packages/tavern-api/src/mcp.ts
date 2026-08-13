import * as z from 'zod';
import { idSchema } from './chat.ts';

const mcpConnectionIdSchema = z
    .string()
    .regex(/^mcp_[A-Za-z0-9_-]{16}$/u, 'Invalid MCP connection id.');
const toolNameSchema = z.string().trim().min(1).max(200);
export const mcpPresetSchema = z.enum(['google-calendar', 'merchbase']);

export const mcpGrantSchema = z
    .object({
        agentId: idSchema,
        connectionId: mcpConnectionIdSchema,
    })
    .strict();

export const mcpConnectionSchema = z
    .object({
        accountLabel: z.string().trim().min(1).max(200).nullable(),
        auth: z.enum(['headers', 'none', 'oauth']),
        connected: z.boolean(),
        grants: z.array(mcpGrantSchema),
        headerNames: z.array(z.string()).max(50),
        id: mcpConnectionIdSchema,
        name: z.string().trim().min(1).max(100),
        preset: mcpPresetSchema.nullable(),
        serverId: idSchema,
        status: z.enum(['online', 'pending']),
        tools: z.array(toolNameSchema),
        url: z.string().url(),
    })
    .strict();

export const mcpConnectionCreateSchema = z
    .object({
        auth: z.enum(['headers', 'none', 'oauth']).default('none'),
        headers: z.record(z.string().trim().min(1), z.string().max(8000)).default({}),
        name: z.string().trim().min(1).max(100),
        oauthClientId: z.string().trim().min(1).max(1000).optional(),
        oauthClientSecret: z.string().max(4000).optional(),
        oauthScopes: z.array(z.string().trim().min(1).max(500)).max(100).default([]),
        serverId: idSchema,
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

export const mcpPresetAccountCreateSchema = z
    .object({
        name: z.string().trim().min(1).max(100),
        preset: mcpPresetSchema,
        serverId: idSchema,
    })
    .strict();

export const mcpOAuthStartSchema = z
    .object({
        allowAuthorizationServerOrigin: z.boolean().default(false),
        connectionId: mcpConnectionIdSchema,
        redirectUrl: z.string().url().max(2000),
        serverId: idSchema,
    })
    .strict();

export const mcpOAuthStartResultSchema = z.discriminatedUnion('status', [
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

export const mcpConnectionListInputSchema = z.object({ serverId: idSchema }).strict();
export const mcpConnectionListSchema = z.array(mcpConnectionSchema);
export const mcpConnectionInputSchema = z
    .object({ connectionId: mcpConnectionIdSchema, serverId: idSchema })
    .strict();
export const mcpHeadersUpdateSchema = mcpConnectionInputSchema
    .extend({
        headers: z.record(z.string().trim().min(1), z.string().max(8000)),
    })
    .strict();

export const mcpGrantInputSchema = mcpGrantSchema.extend({
    enabled: z.boolean(),
    serverId: idSchema,
});

export type McpConnection = z.infer<typeof mcpConnectionSchema>;
export type McpConnectionCreate = z.infer<typeof mcpConnectionCreateSchema>;
export type McpGrant = z.infer<typeof mcpGrantSchema>;
export type McpOAuthStart = z.infer<typeof mcpOAuthStartSchema>;
export type McpOAuthStartResult = z.infer<typeof mcpOAuthStartResultSchema>;
export type McpPreset = z.infer<typeof mcpPresetSchema>;
export type McpPresetAccountCreate = z.infer<typeof mcpPresetAccountCreateSchema>;
