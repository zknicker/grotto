import { z } from 'zod';

export const computerBootstrapProtocolVersion = 1;
export const computerProtocolVersion = 3;

export const computerUpdatePhaseSchema = z.enum([
    'idle',
    'checking',
    'available',
    'requested',
    'downloading',
    'verifying',
    'installing',
    'waiting-for-agents',
    'restarting',
    'complete',
    'failed',
]);
export type ComputerUpdatePhase = z.infer<typeof computerUpdatePhaseSchema>;

export const computerUpdateProgressSchema = z
    .object({
        activeAgentCount: z.number().int().nonnegative().nullable(),
        detail: z.string().max(500).nullable(),
        downloadedBytes: z.number().int().nonnegative().nullable(),
        failedPhase: computerUpdatePhaseSchema.exclude(['failed']).nullable(),
        phase: computerUpdatePhaseSchema,
        targetVersion: z.string().max(64).nullable(),
        totalBytes: z.number().int().positive().nullable(),
        updatedAt: z.string().datetime(),
    })
    .strict();
export type ComputerUpdateProgress = z.infer<typeof computerUpdateProgressSchema>;

export const signedComputerReleaseSchema = z
    .object({
        release: z
            .object({
                artifactUrl: z
                    .string()
                    .url()
                    .refine((value) => new URL(value).protocol === 'https:'),
                protocolVersion: z.number().int().positive(),
                sha256: z.string().regex(/^[a-f0-9]{64}$/u),
                sourceRevision: z.string().regex(/^[a-f0-9]{40}$/u),
                version: z.string().regex(/^\d+\.\d+\.\d+$/u),
            })
            .strict(),
        signature: z.string().regex(/^(?:[A-Za-z0-9+/]{4}){21}[A-Za-z0-9+/]{2}==$/u),
    })
    .strict();
export type SignedComputerRelease = z.infer<typeof signedComputerReleaseSchema>;

export const computerBootstrapHelloSchema = z
    .object({
        architecture: z.string().min(1).max(64),
        bootstrapProtocolVersion: z.literal(computerBootstrapProtocolVersion),
        credential: z.string().min(32),
        health: z.enum(['degraded', 'healthy']),
        operatingSystem: z.string().min(1).max(64),
        productVersion: z.string().min(1).max(64),
        protocolVersion: z.number().int().nonnegative(),
        type: z.literal('bootstrap'),
        update: computerUpdateProgressSchema,
    })
    .strict();

export const computerBootstrapAcceptedSchema = z
    .object({
        mode: z.enum(['ordinary', 'update-required']),
        type: z.literal('bootstrap-accepted'),
    })
    .strict();

export const computerUpdateCommandSchema = z
    .object({
        release: signedComputerReleaseSchema,
        type: z.literal('update'),
    })
    .strict();

export const computerUpdateProgressFrameSchema = z
    .object({
        type: z.literal('update-progress'),
        update: computerUpdateProgressSchema,
    })
    .strict();

/** Exact bytes signed by the production Computer release key. */
export function computerReleaseSigningPayload(release: SignedComputerRelease['release']): string {
    return JSON.stringify({
        artifactUrl: release.artifactUrl,
        protocolVersion: release.protocolVersion,
        sha256: release.sha256,
        sourceRevision: release.sourceRevision,
        version: release.version,
    });
}
