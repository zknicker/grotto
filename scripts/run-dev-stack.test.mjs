import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getDevEnvironmentOverrides } from './run-dev-stack.mjs';

test('loads private Clerk dev sign-in config from the copied root env', () => {
    const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'grotto-dev-env-'));

    try {
        fs.mkdirSync(path.join(repositoryRoot, 'apps', 'website'), { recursive: true });
        fs.writeFileSync(
            path.join(repositoryRoot, '.env'),
            'CLERK_SECRET_KEY=sk_test_root\nDEV_CLERK_SIGN_IN_USER_ID=user_root\n'
        );
        fs.writeFileSync(
            path.join(repositoryRoot, 'apps', 'website', '.env.development'),
            'VITE_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhbXBsZS5jb20k\n'
        );

        assert.deepEqual(getDevEnvironmentOverrides(repositoryRoot, {}), {
            CLERK_ISSUER_URL: 'https://example.com',
            CLERK_SECRET_KEY: 'sk_test_root',
            DEV_CLERK_SIGN_IN_USER_ID: 'user_root',
            GROTTO_CLERK_PUBLISHABLE_KEY: 'pk_test_ZXhhbXBsZS5jb20k',
        });
    } finally {
        fs.rmSync(repositoryRoot, { force: true, recursive: true });
    }
});

test('does not override Clerk configuration already present in the process environment', () => {
    const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'grotto-dev-env-'));

    try {
        fs.writeFileSync(
            path.join(repositoryRoot, '.env'),
            'CLERK_SECRET_KEY=sk_test_root\nDEV_CLERK_SIGN_IN_USER_ID=user_root\n'
        );

        assert.deepEqual(
            getDevEnvironmentOverrides(repositoryRoot, {
                CLERK_SECRET_KEY: 'sk_test_shell',
                DEV_CLERK_SIGN_IN_USER_ID: 'user_shell',
            }),
            {}
        );
    } finally {
        fs.rmSync(repositoryRoot, { force: true, recursive: true });
    }
});
