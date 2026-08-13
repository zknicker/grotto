import { describe, expect, test } from 'bun:test';
import type { AgentRuntimeConnectionOutput } from '../../lib/trpc.tsx';
import { getRuntimeVersionMismatchDescription } from './runtime-version-gate.ts';
import {
    formatCapabilityDisabledReason,
    getCapability,
    routeTabCapabilityRequirements,
    settingsCapabilityRequirements,
} from './use-capability.ts';

describe('Runtime capability gates', () => {
    test('blocks Runtime-backed gates when the Runtime version contract is mismatched', () => {
        const capability = getCapability(
            createRuntimeConnection({
                runtimeVersion: '1.2.1',
                versionStatus: 'mismatched',
            }),
            ['apiServer', 'gateway']
        );

        expect(capability.healthy).toBe(false);
        expect(formatCapabilityDisabledReason(capability)).toBe('Grotto Runtime update required.');
    });

    test('names Tavern as the required update when Runtime is newer than the app', () => {
        const capability = getCapability(
            createRuntimeConnection({
                requiredRuntimeVersion: '1.2.2',
                runtimeVersion: '1.2.3',
                versionStatus: 'mismatched',
            }),
            ['apiServer', 'gateway']
        );

        expect(capability.healthy).toBe(false);
        expect(formatCapabilityDisabledReason(capability)).toBe('Grotto update required.');
    });

    test('gates Connections settings on Runtime API access', () => {
        expect(settingsCapabilityRequirements.connections).toEqual(['apiServer']);
    });

    test('keeps local shell tabs reachable without Runtime capabilities', () => {
        expect(routeTabCapabilityRequirements.search).toEqual([]);
        expect(routeTabCapabilityRequirements.chat).toEqual([]);
        expect(routeTabCapabilityRequirements.activity).toEqual([]);
        expect(routeTabCapabilityRequirements.members).toEqual([]);
    });

    test('gates Stats settings on model execution', () => {
        expect(settingsCapabilityRequirements.stats).toEqual(['modelExecution']);
    });

    test('keeps Models settings reachable when model credentials need setup', () => {
        expect(settingsCapabilityRequirements.models).toEqual(['apiServer']);
    });

    test('keeps Tasks reachable without Runtime capabilities', () => {
        expect(routeTabCapabilityRequirements.tasks).toEqual([]);
    });

    test('explains old Runtime version mismatch beside green capability probes', () => {
        expect(
            getRuntimeVersionMismatchDescription(
                createRuntimeConnection({
                    requiredRuntimeVersion: '1.2.2',
                    runtimeVersion: '1.2.1',
                    versionStatus: 'mismatched',
                })
            )
        ).toBe(
            'Runtime v1.2.1 is older than this app requires (v1.2.2). Chat and Runtime-backed settings stay disabled until Runtime updates.'
        );
    });
});

function createRuntimeConnection(
    overrides: Partial<NonNullable<AgentRuntimeConnectionOutput>> = {}
): NonNullable<AgentRuntimeConnectionOutput> {
    return {
        appVersion: '1.2.2',
        authConfigured: false,
        baseUrl: 'http://127.0.0.1:18790',
        capabilities: [createCapability('apiServer'), createCapability('gateway')],
        enabled: true,
        id: 'runtime',
        isActive: true,
        lastCheckedAt: null,
        lastError: null,
        lastSyncedAt: null,
        name: 'Grotto Runtime',
        requiredRuntimeVersion: '1.2.2',
        runtimeCapabilities: [createCapability('apiServer'), createCapability('gateway')],
        runtimeVersion: '1.2.1',
        source: 'saved',
        versionStatus: 'compatible',
        ...overrides,
    };
}

function createCapability(
    capability: NonNullable<AgentRuntimeConnectionOutput>['runtimeCapabilities'][number]['capability']
): NonNullable<AgentRuntimeConnectionOutput>['runtimeCapabilities'][number] {
    return {
        capability,
        checkedAt: '2026-06-03T00:00:00.000Z',
        displayName: null,
        errorCode: null,
        lastHealthyAt: '2026-06-03T00:00:00.000Z',
        metadataJson: '{}',
        method: 'runtime.capabilities',
        reason: null,
        runtimeId: 'runtime',
        state: 'healthy',
        technicalMessage: null,
        updatedAt: '2026-06-03T00:00:00.000Z',
    };
}
