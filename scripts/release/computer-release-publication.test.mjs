import { expect, test } from 'bun:test';
import { generateKeyPairSync } from 'node:crypto';
import { createSignedComputerRelease } from './computer-release-contract.mjs';
import {
    assertImmutableObjectAbsent,
    ensureImmutableObject,
    immutableObjectExists,
    readProductionComputerRelease,
} from './computer-release-publication.mjs';

test('an absent immutable S3 key accepts both AWS CLI missing-object results', () => {
    const missingEmpty = () => ({ status: 0, stderr: '', stdout: '' });
    const missingStatus = () => ({ status: 1, stderr: '', stdout: '' });
    const existing = () => ({
        status: 0,
        stderr: '',
        stdout: '2026-07-28 1 artifact\n',
    });
    const failed = () => ({ status: 1, stderr: 'AccessDenied', stdout: '' });

    expect(() => assertImmutableObjectAbsent('s3://bucket/key', missingEmpty)).not.toThrow();
    expect(() => assertImmutableObjectAbsent('s3://bucket/key', missingStatus)).not.toThrow();
    expect(() => assertImmutableObjectAbsent('s3://bucket/key', existing)).toThrow(
        'already exists'
    );
    expect(() => assertImmutableObjectAbsent('s3://bucket/key', failed)).toThrow('Could not check');
    expect(immutableObjectExists('s3://bucket/key', existing)).toBe(true);
    expect(immutableObjectExists('s3://bucket/key', missingEmpty)).toBe(false);
});

test('an interrupted publish reuses only byte-identical immutable objects', async () => {
    const copies = [];
    await expect(
        ensureImmutableObject('/local', 's3://bucket/key', {
            copy: (source, destination) => copies.push([source, destination]),
            exists: () => false,
        })
    ).resolves.toBe('published');
    expect(copies).toEqual([['/local', 's3://bucket/key']]);

    await expect(
        ensureImmutableObject('/local', 's3://bucket/key', {
            exists: () => true,
            readRemoteSha256: async () => 'same',
            sha256: async () => 'same',
        })
    ).resolves.toBe('reused');
    await expect(
        ensureImmutableObject('/local', 's3://bucket/key', {
            exists: () => true,
            readRemoteSha256: async () => 'remote',
            sha256: async () => 'local',
        })
    ).rejects.toThrow('differs from local release');
});

test('production release reads verify continuity and allow only an initial 404', async () => {
    const trusted = generateKeyPairSync('ed25519');
    const untrusted = generateKeyPairSync('ed25519');
    const descriptor = createSignedComputerRelease(
        {
            artifactUrl:
                'https://releases.grotto.sh/computer/1.1.0/grotto-computer-aarch64-apple-darwin',
            protocolVersion: 3,
            sha256: 'a'.repeat(64),
            sourceRevision: 'b'.repeat(40),
            version: '1.1.0',
        },
        trusted.privateKey
    );
    const request = async () => Response.json(descriptor);

    await expect(
        readProductionComputerRelease(
            'https://releases.grotto.sh/computer/latest.json',
            trusted.publicKey,
            request
        )
    ).resolves.toEqual(descriptor);
    await expect(
        readProductionComputerRelease(
            'https://releases.grotto.sh/computer/latest.json',
            untrusted.publicKey,
            request
        )
    ).rejects.toThrow('signature verification failed');
    await expect(
        readProductionComputerRelease(
            'https://releases.grotto.sh/computer/latest.json',
            trusted.publicKey,
            async () => new Response(null, { status: 404 })
        )
    ).resolves.toBeNull();
});
