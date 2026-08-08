import { describe, expect, test } from 'bun:test';
import { getCoveOnboardingView } from './cove-onboarding-model.ts';

describe('Cove onboarding phase-to-view mapping', () => {
    test('shows the Computer connection action before a Computer connects', () => {
        expect(
            getCoveOnboardingView({
                channelId: 'cht_onboarding',
                computerId: null,
                failure: null,
                phase: 'awaiting-computer',
            })
        ).toBe('connect-computer');
    });

    test('shows live detection progress after a Computer connects', () => {
        expect(
            getCoveOnboardingView({
                channelId: 'cht_onboarding',
                computerId: 'cmp_first',
                failure: null,
                phase: 'awaiting-computer',
            })
        ).toBe('detecting-runtimes');
    });

    test('keeps Computer failures on the repairable connection view', () => {
        expect(
            getCoveOnboardingView({
                channelId: 'cht_onboarding',
                computerId: 'cmp_first',
                failure: {
                    code: 'inventory-empty',
                    detail: 'No usable runtime and model were reported.',
                },
                phase: 'awaiting-computer',
            })
        ).toBe('connect-failed');
    });

    test('advances only durable awaiting-Cove state to Meet Cove', () => {
        expect(
            getCoveOnboardingView({
                channelId: 'cht_onboarding',
                computerId: 'cmp_first',
                failure: null,
                phase: 'awaiting-cove',
            })
        ).toBe('meet-cove');
    });

    test('unlocks the general App only for durable completion', () => {
        expect(
            getCoveOnboardingView({
                channelId: 'cht_onboarding',
                computerId: 'cmp_first',
                failure: null,
                phase: 'complete',
            })
        ).toBe('app');
    });
});
