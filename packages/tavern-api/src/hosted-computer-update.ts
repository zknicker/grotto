import { z } from 'zod';

export const computerBootstrapProtocolVersion = 1;
export const computerProtocolVersion = 2;

export const computerUpdatePhaseSchema = z.enum([
    'idle',
    'checking',
    'available',
    'installing',
    'waiting-for-agents',
    'restarting',
    'complete',
    'failed',
]);
export type ComputerUpdatePhase = z.infer<typeof computerUpdatePhaseSchema>;

export const computerUpdateProgressSchema = z
    .object({
        detail: z.string().max(500).nullable(),
        phase: computerUpdatePhaseSchema,
        targetVersion: z.string().max(64).nullable(),
        updatedAt: z.string().datetime(),
    })
    .strict();
export type ComputerUpdateProgress = z.infer<typeof computerUpdateProgressSchema>;

export const signedComputerReleaseSchema = z
    .object({
        release: z
            .object({
                sha256: z.string().regex(/^[a-f0-9]{64}$/u),
                tarballUrl: z.string().url(),
                version: z.string().min(1).max(64),
            })
            .strict(),
        signature: z.string().min(32).max(1024),
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
        sha256: release.sha256,
        tarballUrl: release.tarballUrl,
        version: release.version,
    });
}
