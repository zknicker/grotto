import { describe, expect, test } from 'bun:test';
import {
    computerBootstrapHelloSchema,
    computerReleaseSigningPayload,
} from './hosted-computer-update.ts';

const progress = {
    detail: null,
    phase: 'idle' as const,
    targetVersion: null,
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
                sha256: 'a'.repeat(64),
                tarballUrl: 'https://releases.grotto.sh/computer.tgz',
                version: '1.2.3',
            })
        ).toBe(
            `{"sha256":"${'a'.repeat(64)}","tarballUrl":"https://releases.grotto.sh/computer.tgz","version":"1.2.3"}`
        );
    });
});
