import { expect, test } from 'bun:test';
import { checkComputerReleasePrerequisite } from './check-computer-prerequisite.mjs';

test('App/Server publishing refuses a production Computer below its protocol floor', async () => {
    const server = Bun.serve({
        fetch: () =>
            Response.json({
                release: {
                    artifactUrl:
                        'https://releases.grotto.sh/computer/1.0.0/grotto-computer-aarch64-apple-darwin',
                    protocolVersion: 2,
                    sha256: 'a'.repeat(64),
                    sourceRevision: 'b'.repeat(40),
                    version: '1.0.0',
                },
                signature: Buffer.alloc(64, 1).toString('base64'),
            }),
        port: 0,
    });
    try {
        await expect(
            checkComputerReleasePrerequisite(`http://127.0.0.1:${server.port}/latest.json`)
        ).rejects.toThrow('below required protocol 3');
    } finally {
        server.stop(true);
    }
});
