import { expect, test } from 'bun:test';
import { handleReleaseRequest } from './index.ts';

test('redirects Computer releases directly to the public S3 prefix', () => {
    const response = handleReleaseRequest(
        new Request('https://releases.grotto.sh/computer/1.1.0/release.json?proof=1')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
        'https://punchpress-electron-app-209596837609-us-east-1-an.s3.us-east-1.amazonaws.com/grotto/mac/computer/1.1.0/release.json?proof=1'
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
});

test('rejects paths outside the Computer release namespace', async () => {
    const response = handleReleaseRequest(new Request('https://releases.grotto.sh/'));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not found.\n');
});
