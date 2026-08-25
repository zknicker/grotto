import assert from 'node:assert/strict';
import test from 'node:test';
import {
    assertReleasePublishableKey,
    loadAppReleaseEnvironment,
} from './app-release-environment.mjs';

const productionKey = 'pk_live_Y2xlcmsuZ3JvdHRvLnNoJA';
const developmentKey = 'pk_test_d29ydGh5LXBlYWNvY2stMTEuY2xlcmsuYWNjb3VudHMuZGV2JA';

test('uses the Clerk publishable key varlock resolved from the schema', () => {
    const environment = { VITE_CLERK_PUBLISHABLE_KEY: ` ${productionKey} ` };

    assert.equal(loadAppReleaseEnvironment({ environment }), productionKey);
    assert.equal(environment.VITE_CLERK_PUBLISHABLE_KEY, ` ${productionKey} `);
});

test('fails before publishing when the release was not run under varlock', () => {
    assert.throws(
        () => loadAppReleaseEnvironment({ environment: {} }),
        /VITE_CLERK_PUBLISHABLE_KEY is required/
    );
});

// A release resolves the development lifecycle by design, so before this guard
// the schema's development arm rode straight into the published Server artifact
// and pointed every signed-in human at the development Clerk instance.
test('refuses a release build carrying the development Clerk instance', () => {
    assert.throws(
        () =>
            assertReleasePublishableKey({
                GROTTO_RESOLVE_RELEASE_TOKENS: 'true',
                VITE_CLERK_PUBLISHABLE_KEY: developmentKey,
            }),
        /must be a pk_live_ key in a release build/
    );
});

test('refuses a release build whose publishable key never resolved', () => {
    assert.throws(
        () => assertReleasePublishableKey({ GROTTO_RESOLVE_RELEASE_TOKENS: 'true' }),
        /must be a pk_live_ key in a release build, but resolved nothing/
    );
});

test('accepts a release build carrying the production Clerk instance', () => {
    assert.doesNotThrow(() =>
        assertReleasePublishableKey({
            GROTTO_RESOLVE_RELEASE_TOKENS: 'true',
            VITE_CLERK_PUBLISHABLE_KEY: productionKey,
        })
    );
});

// Off the release lane the development key is the correct answer, so the guard
// stays out of the way of the dev stack and the artifact structure tests.
test('leaves non-release builds free to use the development Clerk instance', () => {
    assert.doesNotThrow(() =>
        assertReleasePublishableKey({ VITE_CLERK_PUBLISHABLE_KEY: developmentKey })
    );
});

test('rejects a release build gated on the production key through the front door', () => {
    assert.throws(
        () =>
            loadAppReleaseEnvironment({
                environment: {
                    GROTTO_RESOLVE_RELEASE_TOKENS: 'true',
                    VITE_CLERK_PUBLISHABLE_KEY: developmentKey,
                },
            }),
        /must be a pk_live_ key in a release build/
    );
});
