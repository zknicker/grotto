import { z } from 'zod';
import { connectionStateSchema } from '../contracts/shared.ts';

export const agentRuntimeCapabilities = [
    'claudeAuth',
    'codexOAuth',
    'memory',
    'memoryExtraction',
    'memoryDreaming',
    'dashboardServer',
    'apiServer',
    'gateway',
    'modelExecution',
    'imageGeneration',
    'skills',
    'cron',
    'autoDispatch',
    'webAccess',
    'browser',
    'devToolkit',
    'identity',
] as const;

export const agentRuntimeCapabilitySchema = z.enum(agentRuntimeCapabilities);

export const agentRuntimeCapabilityStateSchema = z.enum([
    'degraded',
    'healthy',
    'unauthorized',
    'unavailable',
    'unknown',
]);

export const agentRuntimeCapabilityStatusSchema = z.object({
    capability: agentRuntimeCapabilitySchema,
    checkedAt: z.string().datetime().nullable(),
    displayName: z.string().nullable().default(null),
    errorCode: z.string().nullable(),
    lastHealthyAt: z.string().datetime().nullable(),
    metadataJson: z.string().nullable(),
    method: z.string().nullable(),
    reason: z.string().nullable(),
    runtimeId: z.string().trim().min(1),
    state: agentRuntimeCapabilityStateSchema,
    technicalMessage: z.string().nullable(),
    updatedAt: z.string().datetime().nullable(),
});

export const agentRuntimeConnectionAuthSchema = z
    .discriminatedUnion('kind', [
        z.object({
            kind: z.literal('token'),
            token: z.string().trim().min(1),
        }),
        z.object({ kind: z.literal('clerk-session') }),
    ])
    .optional();

export const agentRuntimeConnectionInputSchema = z.object({
    auth: agentRuntimeConnectionAuthSchema,
    baseUrl: z.string().url(),
    enabled: z.boolean().optional(),
    id: z.string().trim().min(1).optional(),
});

export const agentRuntimeConnectionSchema = z.object({
    appVersion: z.string().trim().min(1),
    authConfigured: z.boolean(),
    baseUrl: z.string().url(),
    capabilities: z.array(agentRuntimeCapabilityStatusSchema).default([]),
    enabled: z.boolean(),
    id: z.string().trim().min(1),
    isActive: z.boolean(),
    lastCheckedAt: z.string().nullable(),
    lastError: z.string().nullable(),
    lastSyncedAt: z.string().nullable(),
    name: z.string().trim().min(1),
    requiredRuntimeVersion: z.string().trim().min(1),
    runtimeCapabilities: z.array(agentRuntimeCapabilityStatusSchema).default([]),
    runtimeVersion: z.string().trim().min(1).nullable(),
    source: z.enum(['environment', 'saved']),
    versionStatus: z.enum(['compatible', 'matched', 'mismatched', 'unknown']),
});

export const agentRuntimeConnectionStatusSchema = z.object({
    capabilities: z.array(agentRuntimeCapabilityStatusSchema).default([]),
    lastCheckedAt: z.string().nullable(),
    lastError: z.string().nullable(),
    state: connectionStateSchema,
    url: z.string().url().nullable(),
});

export type AgentRuntimeConnection = z.infer<typeof agentRuntimeConnectionSchema>;
export type AgentRuntimeConnectionAuth = z.infer<typeof agentRuntimeConnectionAuthSchema>;
export type AgentRuntimeCapability = z.infer<typeof agentRuntimeCapabilitySchema>;
export type AgentRuntimeCapabilityState = z.infer<typeof agentRuntimeCapabilityStateSchema>;
export type AgentRuntimeCapabilityStatus = z.infer<typeof agentRuntimeCapabilityStatusSchema>;
export type AgentRuntimeConnectionInput = z.infer<typeof agentRuntimeConnectionInputSchema>;
export type AgentRuntimeConnectionStatus = z.infer<typeof agentRuntimeConnectionStatusSchema>;
