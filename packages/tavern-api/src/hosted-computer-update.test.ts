import { describe, expect, test } from 'bun:test';
import {
    computerBootstrapHelloSchema,
    computerReleaseSigningPayload,
    signedComputerReleaseSchema,
} from './hosted-computer-update.ts';

const progress = {
    activeAgentCount: null,
    detail: null,
    downloadedBytes: null,
    failedPhase: null,
    phase: 'idle' as const,
    targetVersion: null,
    totalBytes: null,
    updatedAt: '2026-07-27T12:00:00.000Z',
};

describe('Computer bootstrap protocol', () => {
    test('rejects the old ordinary hello instead of preserving a fallback', () => {
        expect(
            computerBootstrapHelloSchema.safeParse({
                architecture: 'arm64',
                credential: 'c'.repeat(32),
                health: 'healthy',
                operatingSystem: 'darwin',
                productVersion: '1.0.0',
                protocolVersion: 1,
                type: 'hello',
            }).success
        ).toBe(false);
    });

    test('admits an incompatible ordinary version through stable bootstrap validation', () => {
        expect(
            computerBootstrapHelloSchema.safeParse({
                architecture: 'arm64',
                bootstrapProtocolVersion: 1,
                credential: 'c'.repeat(32),
                health: 'healthy',
                operatingSystem: 'darwin',
                productVersion: '0.8.0',
                protocolVersion: 999,
                type: 'bootstrap',
                update: progress,
            }).success
        ).toBe(true);
    });

    test('signing payload has one stable field order', () => {
        expect(
            computerReleaseSigningPayload({
                artifactUrl:
                    'https://releases.grotto.sh/computer/1.2.3/grotto-computer-aarch64-apple-darwin',
                protocolVersion: 3,
                sha256: 'a'.repeat(64),
                sourceRevision: 'b'.repeat(40),
                version: '1.2.3',
            })
        ).toBe(
            `{"artifactUrl":"https://releases.grotto.sh/computer/1.2.3/grotto-computer-aarch64-apple-darwin","protocolVersion":3,"sha256":"${'a'.repeat(64)}","sourceRevision":"${'b'.repeat(40)}","version":"1.2.3"}`
        );
    });

    test('rejects non-HTTPS artifacts and malformed Ed25519 signatures', () => {
        const descriptor = {
            release: {
                artifactUrl: 'http://releases.grotto.sh/computer/1.2.3/computer',
                protocolVersion: 3,
                sha256: 'a'.repeat(64),
                sourceRevision: 'b'.repeat(40),
                version: '1.2.3',
            },
            signature: Buffer.alloc(64, 1).toString('base64'),
        };
        expect(signedComputerReleaseSchema.safeParse(descriptor).success).toBe(false);
        expect(
            signedComputerReleaseSchema.safeParse({
                ...descriptor,
                release: { ...descriptor.release, artifactUrl: 'https://releases.grotto.sh/a' },
                signature: 'base64-looking-but-not-an-ed25519-signature',
            }).success
        ).toBe(false);
    });
});
