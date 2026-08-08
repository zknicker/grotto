import { expect, test } from 'bun:test';
import { isRuntimeVersionAcceptedByApp } from './release-utils.mjs';

test('accepts the App release Runtime without raising an older compatible floor', () => {
    expect(
        isRuntimeVersionAcceptedByApp({
            appVersion: '1.8.0',
            minimumVersion: '1.6.2',
            runtimeVersion: '1.8.0',
        })
    ).toBe(true);
});

test('accepts the existing minimum Runtime epoch and rejects other versions', () => {
    expect(
        isRuntimeVersionAcceptedByApp({
            appVersion: '1.8.0',
            minimumVersion: '1.6.2',
            runtimeVersion: '1.6.4',
        })
    ).toBe(true);
    expect(
        isRuntimeVersionAcceptedByApp({
            appVersion: '1.8.0',
            minimumVersion: '1.6.2',
            runtimeVersion: '1.7.0',
        })
    ).toBe(false);
});
