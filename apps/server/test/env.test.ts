import assert from 'node:assert/strict';
import os from 'node:os';
import test from 'node:test';
import {
    getDefaultAppOrigin,
    getDefaultDatabasePath,
    parseEnvironment,
} from '../src/config/env.ts';

test('getDefaultAppOrigin uses the Grotto website port when present', () => {
    const previousPort = process.env.GROTTO_WEBSITE_PORT;

    process.env.GROTTO_WEBSITE_PORT = '4242';

    try {
        assert.equal(getDefaultAppOrigin(), 'http://localhost:4242');
    } finally {
        restoreEnvironmentVariable('GROTTO_WEBSITE_PORT', previousPort);
    }
});

test('getDefaultAppOrigin falls back to the standard website port', () => {
    const previousPort = process.env.GROTTO_WEBSITE_PORT;

    process.env.GROTTO_WEBSITE_PORT = undefined;

    try {
        assert.equal(getDefaultAppOrigin(), 'http://localhost:3100');
    } finally {
        restoreEnvironmentVariable('GROTTO_WEBSITE_PORT', previousPort);
    }
});

test('getDefaultAppOrigin ignores an invalid website port override', () => {
    const previousPort = process.env.GROTTO_WEBSITE_PORT;

    process.env.GROTTO_WEBSITE_PORT = 'nope';

    try {
        assert.equal(getDefaultAppOrigin(), 'http://localhost:3100');
    } finally {
        restoreEnvironmentVariable('GROTTO_WEBSITE_PORT', previousPort);
    }
});

test('getDefaultDatabasePath uses a temp database during tests', () => {
    const previousNodeEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = 'test';

    try {
        assert.equal(getDefaultDatabasePath().startsWith(os.tmpdir()), true);
        assert.equal(getDefaultDatabasePath().includes('grotto-tests'), true);
    } finally {
        restoreEnvironmentVariable('NODE_ENV', previousNodeEnv);
    }
});

test('production releases require a real Clerk secret before opening the Server', () => {
    const production = {
        ...process.env,
        CLERK_SECRET_KEY: undefined,
        GROTTO_RELEASE_MANIFEST: '/tmp/grotto-release.json',
        NODE_ENV: 'test',
    };

    assert.throws(() => parseEnvironment(production), /CLERK_SECRET_KEY/u);
    assert.throws(
        () => parseEnvironment({ ...production, CLERK_SECRET_KEY: 'INJECT_ON_HOST' }),
        /CLERK_SECRET_KEY/u
    );
    assert.equal(
        parseEnvironment({ ...production, CLERK_SECRET_KEY: 'sk_test_fixture' }).CLERK_SECRET_KEY,
        'sk_test_fixture'
    );
});

function restoreEnvironmentVariable(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
        return;
    }

    process.env[key] = value;
}
