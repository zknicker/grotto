import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppReleaseEnvironment } from './app-release-environment.mjs';

test('uses the Clerk publishable key varlock resolved from the schema', () => {
    const environment = { VITE_CLERK_PUBLISHABLE_KEY: ' pk_live_environment ' };

    assert.equal(loadAppReleaseEnvironment({ environment }), 'pk_live_environment');
    assert.equal(environment.VITE_CLERK_PUBLISHABLE_KEY, ' pk_live_environment ');
});

test('fails before publishing when the release was not run under varlock', () => {
    assert.throws(
        () => loadAppReleaseEnvironment({ environment: {} }),
        /VITE_CLERK_PUBLISHABLE_KEY is required/
    );
});
