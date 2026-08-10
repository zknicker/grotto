import { describe, expect, test } from 'bun:test';
import {
    getRuntimeVersionStatus,
    isCompatibleRuntimeVersion,
} from '../src/agent-runtime-connection/version-compatibility.ts';

describe('Runtime version compatibility', () => {
    test('accepts patch releases in the required Runtime API epoch', () => {
        expect(
            isCompatibleRuntimeVersion({
                requiredRuntimeVersion: '1.1.11',
                runtimeVersion: '1.1.11',
            })
        ).toBe(true);
        expect(
            isCompatibleRuntimeVersion({
                requiredRuntimeVersion: '1.1.11',
                runtimeVersion: '1.1.19',
            })
        ).toBe(true);
    });

    test('rejects older or different Runtime API epochs', () => {
        expect(
            isCompatibleRuntimeVersion({
                requiredRuntimeVersion: '1.1.11',
                runtimeVersion: '1.1.10',
            })
        ).toBe(false);
        expect(
            isCompatibleRuntimeVersion({
                requiredRuntimeVersion: '1.1.11',
                runtimeVersion: '1.2.0',
            })
        ).toBe(false);
    });

    test('distinguishes exact match from compatible skew', () => {
        expect(
            getRuntimeVersionStatus({
                appVersion: '1.1.12',
                requiredRuntimeVersion: '1.1.11',
                runtimeVersion: '1.1.12',
            })
        ).toBe('matched');
        expect(
            getRuntimeVersionStatus({
                appVersion: '1.8.6',
                requiredRuntimeVersion: '1.6.2',
                runtimeVersion: '1.8.5',
            })
        ).toBe('compatible');
    });

    test('rejects intermediate epochs and Runtime patches newer than the App', () => {
        expect(
            getRuntimeVersionStatus({
                appVersion: '1.8.6',
                requiredRuntimeVersion: '1.6.2',
                runtimeVersion: '1.7.0',
            })
        ).toBe('mismatched');
        expect(
            getRuntimeVersionStatus({
                appVersion: '1.8.6',
                requiredRuntimeVersion: '1.6.2',
                runtimeVersion: '1.8.7',
            })
        ).toBe('mismatched');
        expect(
            getRuntimeVersionStatus({
                appVersion: '1.6.6',
                requiredRuntimeVersion: '1.6.2',
                runtimeVersion: '1.6.1',
            })
        ).toBe('mismatched');
    });
});
