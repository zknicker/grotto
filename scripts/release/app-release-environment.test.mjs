import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppReleaseEnvironment } from './app-release-environment.mjs';

test('keeps an explicitly configured Clerk publishable key', () => {
    const environment = { VITE_CLERK_PUBLISHABLE_KEY: ' pk_live_environment ' };
    let keychainRead = false;

    const result = loadAppReleaseEnvironment({
        environment,
        readKeychainPassword: () => {
            keychainRead = true;
            return 'pk_live_keychain';
        },
    });

    assert.equal(result, 'pk_live_environment');
    assert.equal(environment.VITE_CLERK_PUBLISHABLE_KEY, ' pk_live_environment ');
    assert.equal(keychainRead, false);
});

test('loads the Clerk publishable key from the login Keychain', () => {
    const environment = {};

    const result = loadAppReleaseEnvironment({
        environment,
        readKeychainPassword: (service) => {
            assert.equal(service, 'grotto-release-clerk-publishable-key');
            return ' pk_live_keychain \n';
        },
    });

    assert.equal(result, 'pk_live_keychain');
    assert.equal(environment.VITE_CLERK_PUBLISHABLE_KEY, 'pk_live_keychain');
});

test('fails before publishing when no Clerk publishable key is configured', () => {
    assert.throws(
        () =>
            loadAppReleaseEnvironment({
                environment: {},
                readKeychainPassword: () => null,
            }),
        /VITE_CLERK_PUBLISHABLE_KEY is required/
    );
});
