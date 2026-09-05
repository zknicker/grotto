import { afterEach, beforeEach, expect, test } from 'bun:test';
import { githubToken, resetGithubToken } from './token.ts';

// The cache is one per process, so a test file that already resolved a token
// must not decide this one's answer.
beforeEach(() => {
    resetGithubToken();
});

afterEach(() => {
    resetGithubToken();
});

test('the local gh token is read exactly once per process', async () => {
    let reads = 0;
    const read = () => {
        reads += 1;
        return Promise.resolve('gho_local_gh_cli_token');
    };

    expect(await githubToken(read)).toBe('gho_local_gh_cli_token');
    expect(await githubToken(read)).toBe('gho_local_gh_cli_token');
    expect(reads).toBe(1);
});

test('a Computer without gh resolves nothing and keeps that answer', async () => {
    let reads = 0;
    const missing = () => {
        reads += 1;
        return Promise.reject(new Error('gh: command not found'));
    };

    expect(await githubToken(missing)).toBeNull();
    expect(await githubToken(missing)).toBeNull();
    // The negative answer is cached too: a Computer without `gh` never shells out twice.
    expect(reads).toBe(1);
});
