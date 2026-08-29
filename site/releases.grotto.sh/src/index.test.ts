import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { handleReleaseRequest, releaseOrigin } from './index.ts';

test('uses the release origin declared by the environment contract', () => {
    const schema = readFileSync('.env.schema', 'utf8');
    const baseUrl = schema.match(/^GROTTO_RELEASE_BASE_URL=(.+)$/mu)?.[1];

    expect(baseUrl).toBe(releaseOrigin.toString().replace(/\/$/u, ''));
});

test('redirects Computer releases directly to the public S3 prefix', () => {
    const response = handleReleaseRequest(
        new Request('https://releases.grotto.sh/computer/1.1.0/release.json?proof=1')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
        'https://punchpress-electron-app-209596837609-us-east-1-an.s3.us-east-1.amazonaws.com/tavern/mac/computer/1.1.0/release.json?proof=1'
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
});

test('redirects the public Grotto release snapshot', () => {
    const response = handleReleaseRequest(
        new Request('https://releases.grotto.sh/grotto/latest.json?proof=1')
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
        'https://punchpress-electron-app-209596837609-us-east-1-an.s3.us-east-1.amazonaws.com/tavern/mac/grotto/latest.json?proof=1'
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
});

test('rejects paths outside the public release namespaces', async () => {
    const response = handleReleaseRequest(new Request('https://releases.grotto.sh/'));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not found.\n');
});
